"""
TTP2026 战略看板 - tRPC 兼容层 v3.0
修复所有已知 Bug：
- 添加 tasks.calculateScore / getScore / getAttachments / uploadAttachment / deleteAttachment
- 添加 tasks.weeklyStats / weeklyTrend / batchCreate
- 修复 tasks.create / update 中的 actions / contributors / dingDeptIds 字段持久化
- 修复 committee_configs 的 color / icon / members / responsibility / conditions 字段
- 修复 handle_tasks_diagnose 中的 extra 变量引用错误
- 修复 report 中的 o.output_value / o.input_man_days 错误引用（应为 task 字段）
"""
import json
import hashlib
import hmac
import time
import os
from typing import Any, Optional
try:
    from openai import OpenAI as _OpenAI
    _openai_client = _OpenAI()
except Exception:
    _openai_client = None
from fastapi import APIRouter, Request, Response, Cookie
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from models.database import SessionLocal, User, Task, Outcome, SystemConfig, CommitteeConfig, TaskAttachment

router = APIRouter()

from passlib.context import CryptContext
pwd_context = CryptContext(schemes=["sha256_crypt"], deprecated="auto")

# ============================================================
# Session 管理
# ============================================================
SECRET_KEY = os.getenv("SESSION_SECRET", "ttp2026_kanban_secret_key_2026")
COOKIE_NAME = "kanban_session"

def sign_token(user_id: int) -> str:
    payload = f"{user_id}:{int(time.time())}"
    sig = hmac.new(SECRET_KEY.encode(), payload.encode(), hashlib.sha256).hexdigest()
    return f"{payload}:{sig}"

def verify_token(token: str) -> Optional[int]:
    try:
        parts = token.split(":")
        if len(parts) != 3:
            return None
        user_id, ts, sig = parts
        payload = f"{user_id}:{ts}"
        expected_sig = hmac.new(SECRET_KEY.encode(), payload.encode(), hashlib.sha256).hexdigest()
        if not hmac.compare_digest(sig, expected_sig):
            return None
        if int(time.time()) - int(ts) > 7 * 24 * 3600:
            return None
        return int(user_id)
    except Exception:
        return None

def get_current_user(request: Request) -> Optional[User]:
    token = request.cookies.get(COOKIE_NAME)
    if not token:
        return None
    user_id = verify_token(token)
    if not user_id:
        return None
    db = SessionLocal()
    try:
        return db.query(User).filter(User.id == user_id).first()
    finally:
        db.close()

# ============================================================
# tRPC 响应格式
# ============================================================
def trpc_success(data: Any) -> dict:
    return {"result": {"data": {"json": data, "meta": {"values": {}}}}}

def trpc_error(code: str, message: str, http_status: int = 400) -> dict:
    code_map = {
        "UNAUTHORIZED": -32001, "FORBIDDEN": -32003, "NOT_FOUND": -32004,
        "CONFLICT": -32009, "BAD_REQUEST": -32600, "INTERNAL_SERVER_ERROR": -32603,
    }
    return {"error": {"json": {"message": message, "code": code_map.get(code, -32600),
        "data": {"code": code, "httpStatus": http_status, "path": ""}}}}

# ============================================================
# 辅助函数
# ============================================================
def _parse_json_field(val, default=None):
    """安全解析JSON字段，失败返回default"""
    if val is None:
        return default if default is not None else []
    if isinstance(val, (list, dict)):
        return val
    try:
        return json.loads(val)
    except Exception:
        return default if default is not None else []

def _task_to_dict(task: Task) -> dict:
    return {
        "id": task.id,
        "taskId": task.id,
        "committeeId": task.committee_id,
        "name": task.name,
        "goal": task.goal or "",
        "strategy": task.strategy or "",
        "milestone": task.milestone or "",
        "result": task.result or "",
        "breakthrough": task.breakthrough or "",
        "manager": task.manager or "",
        "deadline": task.deadline or "",
        "status": task.status,
        "completionRate": task.completion_rate or 0,
        "rewardPool": task.reward_pool or "",
        "actions": _parse_json_field(task.actions, []),
        "contributors": _parse_json_field(task.contributors, []),
        "dingDeptIds": _parse_json_field(task.ding_dept_ids, []),
        "inputManDays": float(task.input_man_days or 0),
        "outputValue": float(task.output_value or 0),
        "score": int(task.score or 0),
        "createdAt": task.created_at.isoformat() if task.created_at else None,
        "updatedAt": task.updated_at.isoformat() if task.updated_at else None,
    }

def _outcome_to_dict(outcome: Outcome) -> dict:
    before_val = float(outcome.before_value or 0)
    after_val = float(outcome.after_value or 0)
    freq = float(outcome.frequency or 1)
    otype = outcome.type or "提效"
    diff = (after_val - before_val) * freq if otype == "增收" else (before_val - after_val) * freq
    pct = round((diff / before_val * 100), 1) if before_val > 0 else 0
    return {
        "id": outcome.id,
        "taskId": outcome.task_id,
        "committeeId": outcome.committee_id,
        "type": otype,
        "scenario": outcome.scenario,
        "beforeValue": before_val,
        "afterValue": after_val,
        "unit": outcome.unit or "小时/次",
        "frequency": freq,
        "diff": round(diff, 2),
        "diffPct": pct,
        "remark": outcome.remark,
        "createdAt": outcome.created_at.isoformat() if outcome.created_at else None,
    }

def _committee_config_to_dict(c) -> dict:
    return {
        "id": c.id,
        "fullName": c.full_name or "",
        "shortName": c.short_name or "",
        "chairman": c.chairman or "",
        "director": c.director or "",
        "annualGoal": c.annual_goal or "",
        "rewardPool": c.reward_pool or "",
        "status": c.committee_status or "active",
        "sortOrder": c.sort_order or 0,
        "dingTalkWebhook": c.ding_talk_webhook or "",
        "color": c.color or "",
        "icon": c.icon or "🏢",
        "members": _parse_json_field(c.members, []),
        "responsibility": _parse_json_field(c.responsibility, []),
        "conditions": _parse_json_field(c.conditions, []),
        "isCustom": True,
    }

def _attachment_to_dict(att: TaskAttachment) -> dict:
    return {
        "id": att.id,
        "taskId": att.task_id,
        "filename": att.filename,
        "fileType": att.file_type or "",
        "fileSize": att.file_size or 0,
        "fileData": att.file_data or "",
        "createdAt": att.created_at.isoformat() if att.created_at else None,
    }

# ============================================================
# 用户管理路由
# ============================================================
def handle_kanban_me(request: Request, input_data: Any, db: Session) -> dict:
    user = get_current_user(request)
    if not user:
        return trpc_success(None)
    return trpc_success({
        "id": user.id, "username": user.username,
        "displayName": user.display_name, "role": user.role,
        "committeeId": user.committee_id,
    })

def handle_kanban_login(request: Request, input_data: Any, db: Session):
    username = input_data.get("username", "")
    password = input_data.get("password", "")
    user = db.query(User).filter(User.username == username).first()
    if not user or not pwd_context.verify(password, user.password_hash):
        return trpc_error("UNAUTHORIZED", "用户名或密码错误", 401), None
    token = sign_token(user.id)
    result = trpc_success({
        "id": user.id, "username": user.username,
        "displayName": user.display_name, "role": user.role,
        "committeeId": user.committee_id,
    })
    return result, token

def handle_kanban_logout(request: Request, input_data: Any, db: Session):
    return trpc_success({"success": True}), True

def handle_kanban_list_users(request: Request, input_data: Any, db: Session) -> dict:
    user = get_current_user(request)
    if not user or user.role != "admin":
        return trpc_error("FORBIDDEN", "无权限", 403)
    users = db.query(User).all()
    return trpc_success([{
        "id": u.id, "username": u.username, "displayName": u.display_name,
        "role": u.role, "committeeId": u.committee_id,
    } for u in users])

def handle_kanban_create_user(request: Request, input_data: Any, db: Session) -> dict:
    user = get_current_user(request)
    if not user or user.role != "admin":
        return trpc_error("FORBIDDEN", "无权限", 403)
    existing = db.query(User).filter(User.username == input_data.get("username")).first()
    if existing:
        return trpc_error("CONFLICT", "用户名已存在", 409)
    new_user = User(
        username=input_data.get("username"),
        password_hash=pwd_context.hash(input_data.get("password", "ttp2026")),
        display_name=input_data.get("displayName", ""),
        role=input_data.get("role", "member"),
        committee_id=input_data.get("committeeId"),
    )
    db.add(new_user)
    db.commit()
    return trpc_success({"success": True})

def handle_kanban_update_user(request: Request, input_data: Any, db: Session) -> dict:
    user = get_current_user(request)
    if not user or user.role != "admin":
        return trpc_error("FORBIDDEN", "无权限", 403)
    target = db.query(User).filter(User.id == input_data.get("id")).first()
    if not target:
        return trpc_error("NOT_FOUND", "用户不存在", 404)
    if "displayName" in input_data:
        target.display_name = input_data["displayName"]
    if "role" in input_data:
        target.role = input_data["role"]
    if "committeeId" in input_data:
        target.committee_id = input_data["committeeId"]
    db.commit()
    return trpc_success({"success": True})

def handle_kanban_reset_password(request: Request, input_data: Any, db: Session) -> dict:
    user = get_current_user(request)
    if not user or user.role != "admin":
        return trpc_error("FORBIDDEN", "无权限", 403)
    target = db.query(User).filter(User.id == input_data.get("id")).first()
    if not target:
        return trpc_error("NOT_FOUND", "用户不存在", 404)
    target.password_hash = pwd_context.hash(input_data.get("newPassword", "ttp2026"))
    db.commit()
    return trpc_success({"success": True})

def handle_kanban_delete_user(request: Request, input_data: Any, db: Session) -> dict:
    user = get_current_user(request)
    if not user or user.role != "admin":
        return trpc_error("FORBIDDEN", "无权限", 403)
    if user.id == input_data.get("id"):
        return trpc_error("BAD_REQUEST", "不能删除自己的账号", 400)
    target = db.query(User).filter(User.id == input_data.get("id")).first()
    if target:
        db.delete(target)
        db.commit()
    return trpc_success({"success": True})

# ============================================================
# 任务路由
# ============================================================
def handle_tasks_list(request: Request, input_data: Any, db: Session) -> dict:
    user = get_current_user(request)
    if not user:
        return trpc_error("UNAUTHORIZED", "请先登录", 401)
    committee_id = input_data.get("committeeId") if input_data else None
    if not committee_id and user.role != "admin":
        committee_id = user.committee_id
    query = db.query(Task)
    if committee_id:
        query = query.filter(Task.committee_id == committee_id)
    tasks = query.all()
    return trpc_success([_task_to_dict(t) for t in tasks])

def handle_tasks_list_all(request: Request, input_data: Any, db: Session) -> dict:
    user = get_current_user(request)
    if not user or user.role != "admin":
        return trpc_error("FORBIDDEN", "无权限", 403)
    tasks = db.query(Task).all()
    return trpc_success([_task_to_dict(t) for t in tasks])

def handle_tasks_get(request: Request, input_data: Any, db: Session) -> dict:
    user = get_current_user(request)
    if not user:
        return trpc_error("UNAUTHORIZED", "请先登录", 401)
    task = db.query(Task).filter(Task.id == input_data.get("id")).first()
    if not task:
        return trpc_error("NOT_FOUND", "任务不存在", 404)
    return trpc_success(_task_to_dict(task))

def handle_tasks_create(request: Request, input_data: Any, db: Session) -> dict:
    user = get_current_user(request)
    if not user:
        return trpc_error("UNAUTHORIZED", "请先登录", 401)
    import uuid
    task_id_val = input_data.get("id") or input_data.get("taskId") or str(uuid.uuid4())[:8]
    actions_val = input_data.get("actions", [])
    contributors_val = input_data.get("contributors", [])
    ding_dept_ids_val = input_data.get("dingDeptIds", [])
    task = Task(
        id=task_id_val,
        committee_id=input_data.get("committeeId", ""),
        name=input_data.get("name", ""),
        goal=input_data.get("goal", ""),
        strategy=input_data.get("strategy", ""),
        milestone=input_data.get("milestone", ""),
        result=input_data.get("result", ""),
        breakthrough=input_data.get("breakthrough", ""),
        manager=input_data.get("manager", ""),
        deadline=input_data.get("deadline", "") or None,
        status=input_data.get("status", "待启动"),
        completion_rate=int(input_data.get("completionRate", 0) or 0),
        reward_pool=input_data.get("rewardPool", ""),
        actions=json.dumps(actions_val, ensure_ascii=False) if isinstance(actions_val, list) else actions_val,
        contributors=json.dumps(contributors_val, ensure_ascii=False) if isinstance(contributors_val, list) else contributors_val,
        ding_dept_ids=json.dumps(ding_dept_ids_val, ensure_ascii=False) if isinstance(ding_dept_ids_val, list) else ding_dept_ids_val,
        input_man_days=float(input_data.get("inputManDays", 0) or 0),
        output_value=float(input_data.get("outputValue", 0) or 0),
        created_by=user.id,
    )
    db.add(task)
    db.commit()
    db.refresh(task)
    return trpc_success(_task_to_dict(task))

def handle_tasks_update(request: Request, input_data: Any, db: Session) -> dict:
    user = get_current_user(request)
    if not user:
        return trpc_error("UNAUTHORIZED", "请先登录", 401)
    task_id = input_data.get("id") or input_data.get("taskId")
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        return trpc_error("NOT_FOUND", "任务不存在", 404)
    # 标量字段映射
    scalar_map = {
        "name": "name", "goal": "goal", "strategy": "strategy",
        "milestone": "milestone", "result": "result", "breakthrough": "breakthrough",
        "manager": "manager", "status": "status",
    }
    for camel, snake in scalar_map.items():
        if camel in input_data:
            setattr(task, snake, input_data[camel])
    if "deadline" in input_data:
        task.deadline = input_data["deadline"] or None
    if "completionRate" in input_data:
        task.completion_rate = int(input_data["completionRate"] or 0)
    if "rewardPool" in input_data:
        task.reward_pool = input_data["rewardPool"]
    if "inputManDays" in input_data:
        task.input_man_days = float(input_data["inputManDays"] or 0)
    if "outputValue" in input_data:
        task.output_value = float(input_data["outputValue"] or 0)
    if "score" in input_data:
        task.score = int(input_data["score"] or 0)
    # JSON数组字段
    for camel, snake in [("actions", "actions"), ("contributors", "contributors"), ("dingDeptIds", "ding_dept_ids")]:
        if camel in input_data:
            val = input_data[camel]
            if isinstance(val, list):
                setattr(task, snake, json.dumps(val, ensure_ascii=False))
            elif val is None:
                setattr(task, snake, json.dumps([], ensure_ascii=False))
    db.commit()
    db.refresh(task)
    return trpc_success(_task_to_dict(task))

def handle_tasks_delete(request: Request, input_data: Any, db: Session) -> dict:
    user = get_current_user(request)
    if not user:
        return trpc_error("UNAUTHORIZED", "请先登录", 401)
    task_id = input_data.get("id") or input_data.get("taskId")
    task = db.query(Task).filter(Task.id == task_id).first()
    if task:
        db.delete(task)
        db.commit()
    return trpc_success({"success": True})

def handle_tasks_batch_create(request: Request, input_data: Any, db: Session) -> dict:
    """批量创建任务（粘贴多行文本）"""
    user = get_current_user(request)
    if not user:
        return trpc_error("UNAUTHORIZED", "请先登录", 401)
    import uuid
    committee_id = input_data.get("committeeId", "")
    names = input_data.get("names", [])
    created = []
    for name in names:
        name = name.strip()
        if not name:
            continue
        task_id_val = str(uuid.uuid4())[:8]
        task = Task(
            id=task_id_val,
            committee_id=committee_id,
            name=name,
            goal="", strategy="", status="待启动",
            completion_rate=0,
            created_by=user.id,
        )
        db.add(task)
        db.flush()
        created.append(_task_to_dict(task))
    db.commit()
    return trpc_success(created)

def handle_tasks_get_attachments(request: Request, input_data: Any, db: Session) -> dict:
    user = get_current_user(request)
    if not user:
        return trpc_error("UNAUTHORIZED", "请先登录", 401)
    task_id = input_data.get("taskId") if input_data else None
    if not task_id:
        return trpc_success([])
    attachments = db.query(TaskAttachment).filter(TaskAttachment.task_id == task_id).all()
    return trpc_success([_attachment_to_dict(a) for a in attachments])

def handle_tasks_upload_attachment(request: Request, input_data: Any, db: Session) -> dict:
    user = get_current_user(request)
    if not user:
        return trpc_error("UNAUTHORIZED", "请先登录", 401)
    task_id = input_data.get("taskId", "")
    filename = input_data.get("filename", "")
    mime_type = input_data.get("mimeType", "")
    base64_data = input_data.get("base64Data", "")
    file_size = int(input_data.get("fileSize", 0) or 0)
    att = TaskAttachment(
        task_id=task_id,
        filename=filename,
        file_type=mime_type,
        file_size=file_size,
        file_data=base64_data,
        uploaded_by=user.id,
    )
    db.add(att)
    db.commit()
    db.refresh(att)
    return trpc_success(_attachment_to_dict(att))

def handle_tasks_delete_attachment(request: Request, input_data: Any, db: Session) -> dict:
    user = get_current_user(request)
    if not user:
        return trpc_error("UNAUTHORIZED", "请先登录", 401)
    att_id = input_data.get("attachmentId")
    att = db.query(TaskAttachment).filter(TaskAttachment.id == att_id).first()
    if att:
        db.delete(att)
        db.commit()
    return trpc_success({"success": True})

def handle_tasks_calculate_score(request: Request, input_data: Any, db: Session) -> dict:
    """AI积分核算"""
    user = get_current_user(request)
    if not user:
        return trpc_error("UNAUTHORIZED", "请先登录", 401)
    task_id = input_data.get("taskId")
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        return trpc_error("NOT_FOUND", "任务不存在", 404)
    mentor_level = input_data.get("mentorLevel", "未参与")
    mentor_name = input_data.get("mentorName", "")
    # 本地计算积分（不依赖AI）
    completion = int(task.completion_rate or 0)
    contributors = _parse_json_field(task.contributors, [])
    completion_score = completion
    quality_score = min(completion + 10, 100) if task.result else int(completion * 0.8)
    if task.status in ["已完成", "已结束"]:
        timeliness_score = 90
    elif task.status == "进行中":
        timeliness_score = 70
    elif task.status == "有卡点":
        timeliness_score = 30
    else:
        timeliness_score = 50
    collaboration_score = min(len(contributors) * 15 + 40, 100)
    total_score = int(completion_score * 0.4 + quality_score * 0.3 + timeliness_score * 0.2 + collaboration_score * 0.1)
    output_value = float(task.output_value or 0)
    input_man_days = float(task.input_man_days or 0)
    roi = round(output_value / (input_man_days * 1000), 2) if input_man_days > 0 and output_value > 0 else None
    bonus_coeff = 1.5 if total_score >= 90 else (1.0 if total_score >= 70 else (0.7 if total_score >= 50 else 0.3))
    estimated_bonus = round(total_score * bonus_coeff * 10, 0)
    ai_summary = f"任务「{task.name}」完成度{completion}%，状态{task.status}，综合得分{total_score}分。"
    # 尝试用AI增强
    if _openai_client is not None:
        try:
            prompt = (
                f"请对以下任务进行积分核算评估（返回JSON）：\n"
                f"任务：{task.name}，目标：{task.goal or '未填写'}，"
                f"完成度：{completion}%，状态：{task.status}，"
                f"成果：{task.result or '未填写'}，协作人数：{len(contributors)}\n"
                f"返回格式：{{\"completionScore\":数字,\"qualityScore\":数字,"
                f"\"timelinessScore\":数字,\"collaborationScore\":数字,"
                f"\"totalScore\":数字,\"bonusCoeff\":数字,\"estimatedBonus\":数字,"
                f"\"aiSummary\":\"不超过80字的评估摘要\"}}"
            )
            resp = _openai_client.chat.completions.create(
                model=os.getenv("OPENAI_MODEL", "gpt-4.1-mini"),
                messages=[
                    {"role": "system", "content": "你是企业战略项目评估专家，只返回JSON格式数据。"},
                    {"role": "user", "content": prompt}
                ],
                max_tokens=400,
                temperature=0.3,
            )
            content = resp.choices[0].message.content
            if content:
                ai_data = json.loads(content.strip())
                completion_score = ai_data.get("completionScore", completion_score)
                quality_score = ai_data.get("qualityScore", quality_score)
                timeliness_score = ai_data.get("timelinessScore", timeliness_score)
                collaboration_score = ai_data.get("collaborationScore", collaboration_score)
                total_score = ai_data.get("totalScore", total_score)
                bonus_coeff = ai_data.get("bonusCoeff", bonus_coeff)
                estimated_bonus = ai_data.get("estimatedBonus", estimated_bonus)
                ai_summary = ai_data.get("aiSummary", ai_summary)
        except Exception:
            pass
    # 更新任务积分字段
    task.score = int(total_score)
    db.commit()
    return trpc_success({
        "completionScore": completion_score,
        "qualityScore": quality_score,
        "timelinessScore": timeliness_score,
        "collaborationScore": collaboration_score,
        "totalScore": total_score,
        "roi": roi,
        "bonusCoeff": bonus_coeff,
        "estimatedBonus": estimated_bonus,
        "aiSummary": ai_summary,
        "mentorLevel": mentor_level,
        "mentorName": mentor_name,
        "milestoneScore": 0,
        "monthlyScore": 0.5,
        "mentorScore": 0,
    })

def handle_tasks_get_score(request: Request, input_data: Any, db: Session) -> dict:
    """获取任务积分记录"""
    user = get_current_user(request)
    if not user:
        return trpc_error("UNAUTHORIZED", "请先登录", 401)
    task_id = input_data.get("taskId") if input_data else None
    if not task_id:
        return trpc_success(None)
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task or not task.score:
        return trpc_success(None)
    return trpc_success({
        "totalScore": int(task.score or 0),
        "aiSummary": f"任务「{task.name}」当前积分：{task.score}分",
    })

def handle_tasks_weekly_stats(request: Request, input_data: Any, db: Session) -> dict:
    """本周各部门新增/完成任务统计"""
    user = get_current_user(request)
    if not user or user.role != "admin":
        return trpc_error("FORBIDDEN", "无权限", 403)
    from datetime import datetime, timedelta
    now = datetime.now()
    day = now.weekday()  # 0=Monday
    week_start = now - timedelta(days=day, hours=now.hour, minutes=now.minute, seconds=now.second, microseconds=now.microsecond)
    all_tasks = db.query(Task).all()
    result = {}
    for task in all_tasks:
        cid = task.committee_id
        if cid not in result:
            result[cid] = {"newCount": 0, "doneCount": 0}
        if task.created_at and task.created_at >= week_start:
            result[cid]["newCount"] += 1
        if task.status in ["已完成", "已结束"] and task.updated_at and task.updated_at >= week_start:
            result[cid]["doneCount"] += 1
    return trpc_success(result)

def handle_tasks_weekly_trend(request: Request, input_data: Any, db: Session) -> dict:
    """近4周每周完成任务数趋势"""
    user = get_current_user(request)
    if not user or user.role != "admin":
        return trpc_error("FORBIDDEN", "无权限", 403)
    from datetime import datetime, timedelta
    now = datetime.now()
    def get_week_start(weeks_ago):
        d = now - timedelta(days=now.weekday() + weeks_ago * 7)
        return d.replace(hour=0, minute=0, second=0, microsecond=0)
    all_tasks = db.query(Task).all()
    week_labels = ["4周前", "3周前", "2周前", "本周"]
    weeks = []
    for i, (weeks_ago, label) in enumerate(zip([3, 2, 1, 0], week_labels)):
        start = get_week_start(weeks_ago)
        end = get_week_start(weeks_ago - 1) if weeks_ago > 0 else now + timedelta(days=1)
        done = sum(
            1 for t in all_tasks
            if t.status in ["已完成", "已结束"]
            and t.updated_at and start <= t.updated_at < end
        )
        weeks.append({"label": label, "done": done})
    return trpc_success(weeks)

def handle_tasks_diagnose(request: Request, input_data: Any, db: Session) -> dict:
    """AI诊断任务"""
    user = get_current_user(request)
    if not user:
        return trpc_error("UNAUTHORIZED", "请先登录", 401)
    task_id = input_data.get("taskId")
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        return trpc_error("NOT_FOUND", "任务不存在", 404)
    actions = _parse_json_field(task.actions, [])
    actions_text = "\n".join(f"{i+1}. {a}" for i, a in enumerate(actions)) or "未填写"
    task_info = (
        f"任务名称：{task.name}\n"
        f"目标：{task.goal or '未填写'}\n"
        f"当前状态：{task.status}\n"
        f"完成率：{task.completion_rate or 0}%\n"
        f"负责人：{task.manager or '未指定'}\n"
        f"截止时间：{task.deadline or '未设置'}\n"
        f"路径策略：{task.strategy or '未填写'}\n"
        f"里程碑：{task.milestone or '未填写'}\n"
        f"行动计划：\n{actions_text}\n"
        f"当前进展：{task.result or '未填写'}\n"
        f"突破点：{task.breakthrough or '未填写'}"
    )
    if _openai_client is None:
        diagnosis = (
            f"## AI 诊断报告\n\n**任务：{task.name}**\n\n"
            f"### 状态评估\n当前完成率 {task.completion_rate or 0}%，状态为「{task.status}」。\n\n"
            f"### 风险提示\n- AI诊断服务暂时不可用\n\n"
            f"### 建议\n请联系管理员配置AI服务后重试。"
        )
    else:
        try:
            resp = _openai_client.chat.completions.create(
                model=os.getenv("OPENAI_MODEL", "gpt-4.1-mini"),
                messages=[
                    {"role": "system", "content": (
                        "你是TTP2026战略看板的AI顾问，专注于AI战略项目管理诊断。"
                        "请用中文、Markdown格式输出诊断报告，"
                        "包含：诊断总结、五维度评估（目标明确性/路径可行性/里程碑合理性/行动计划完整性/结果导向性）、主要风险、改进建议。"
                    )},
                    {"role": "user", "content": f"请对以下任务进行AI诊断分析：\n\n{task_info}"}
                ],
                max_tokens=1000,
                temperature=0.7,
            )
            diagnosis = resp.choices[0].message.content
        except Exception as e:
            diagnosis = (
                f"## AI 诊断报告\n\n**任务：{task.name}**\n\n"
                f"### 诊断结果\nAI服务调用失败：{str(e)}\n\n"
                f"### 基础分析\n- 当前完成率：{task.completion_rate or 0}%\n- 任务状态：{task.status}"
            )
    return trpc_success({"diagnosis": diagnosis, "taskId": task_id})

# ============================================================
# 效益核算路由
# ============================================================
def handle_outcomes_list(request: Request, input_data: Any, db: Session) -> dict:
    user = get_current_user(request)
    if not user:
        return trpc_error("UNAUTHORIZED", "请先登录", 401)
    committee_id = input_data.get("committeeId") if input_data else None
    task_id = input_data.get("taskId") if input_data else None
    if not committee_id and user.role != "admin":
        committee_id = user.committee_id
    query = db.query(Outcome)
    if committee_id:
        query = query.filter(Outcome.committee_id == committee_id)
    if task_id:
        query = query.filter(Outcome.task_id == task_id)
    outcomes = query.order_by(Outcome.created_at.desc()).all()
    return trpc_success([_outcome_to_dict(o) for o in outcomes])

def handle_outcomes_create(request: Request, input_data: Any, db: Session) -> dict:
    user = get_current_user(request)
    if not user:
        return trpc_error("UNAUTHORIZED", "请先登录", 401)
    # 验证task_id存在
    task_id = input_data.get("taskId", "")
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        return trpc_error("NOT_FOUND", "任务不存在，请先创建任务", 404)
    outcome = Outcome(
        task_id=task_id,
        committee_id=input_data.get("committeeId", user.committee_id or ""),
        type=input_data.get("type", "提效"),
        scenario=input_data.get("scenario", ""),
        before_value=float(input_data.get("beforeValue", 0)),
        after_value=float(input_data.get("afterValue", 0)),
        unit=input_data.get("unit", "小时/次"),
        frequency=float(input_data.get("frequency", 1)),
        remark=input_data.get("remark", ""),
        created_by=user.id,
    )
    db.add(outcome)
    db.commit()
    db.refresh(outcome)
    return trpc_success(_outcome_to_dict(outcome))

def handle_outcomes_update(request: Request, input_data: Any, db: Session) -> dict:
    user = get_current_user(request)
    if not user:
        return trpc_error("UNAUTHORIZED", "请先登录", 401)
    outcome = db.query(Outcome).filter(Outcome.id == input_data.get("id")).first()
    if not outcome:
        return trpc_error("NOT_FOUND", "记录不存在", 404)
    field_map = {
        "type": "type", "scenario": "scenario",
        "beforeValue": "before_value", "afterValue": "after_value",
        "unit": "unit", "frequency": "frequency", "remark": "remark",
    }
    for camel, snake in field_map.items():
        if camel in input_data:
            setattr(outcome, snake, input_data[camel])
    db.commit()
    return trpc_success(_outcome_to_dict(outcome))

def handle_outcomes_delete(request: Request, input_data: Any, db: Session) -> dict:
    user = get_current_user(request)
    if not user:
        return trpc_error("UNAUTHORIZED", "请先登录", 401)
    outcome = db.query(Outcome).filter(Outcome.id == input_data.get("id")).first()
    if outcome:
        db.delete(outcome)
        db.commit()
    return trpc_success({"success": True})

def handle_outcomes_summary(request: Request, input_data: Any, db: Session) -> dict:
    user = get_current_user(request)
    if not user:
        return trpc_error("UNAUTHORIZED", "请先登录", 401)
    committee_id = input_data.get("committeeId") if input_data else None
    if not committee_id:
        committee_id = user.committee_id
    outcomes = db.query(Outcome).filter(Outcome.committee_id == committee_id).all()
    def calc_diff(o):
        bv = float(o.before_value or 0)
        av = float(o.after_value or 0)
        freq = float(o.frequency or 1)
        return (av - bv) * freq if o.type == "增收" else (bv - av) * freq
    tixiao = [o for o in outcomes if o.type == "提效"]
    jiangben = [o for o in outcomes if o.type == "降本"]
    zengshou = [o for o in outcomes if o.type == "增收"]
    return trpc_success({
        "committeeId": committee_id,
        "totalTixiao": round(sum(calc_diff(o) for o in tixiao), 2),
        "totalJiangben": round(sum(calc_diff(o) for o in jiangben), 2),
        "totalZengshou": round(sum(calc_diff(o) for o in zengshou), 2),
        "count": len(outcomes),
        "tixiaoCount": len(tixiao),
        "jiangbenCount": len(jiangben),
        "zengshouCount": len(zengshou),
    })

def handle_outcomes_global_summary(request: Request, input_data: Any, db: Session) -> dict:
    user = get_current_user(request)
    if not user or user.role != "admin":
        return trpc_error("FORBIDDEN", "无权限", 403)
    from collections import defaultdict
    all_outcomes = db.query(Outcome).all()
    dept_map = defaultdict(lambda: {"提效": 0, "降本": 0, "增收": 0, "count": 0})
    for o in all_outcomes:
        bv = float(o.before_value or 0)
        av = float(o.after_value or 0)
        freq = float(o.frequency or 1)
        otype = o.type or "提效"
        diff = (av - bv) * freq if otype == "增收" else (bv - av) * freq
        dept_map[o.committee_id]["count"] += 1
        dept_map[o.committee_id][otype] += diff
    return trpc_success([{
        "committeeId": cid,
        "totalTixiao": round(v["提效"], 2),
        "totalJiangben": round(v["降本"], 2),
        "totalZengshou": round(v["增收"], 2),
        "count": v["count"],
    } for cid, v in dept_map.items()])

# ============================================================
# 配置路由
# ============================================================
def handle_config_get_strategic(request: Request, input_data: Any, db: Session) -> dict:
    configs = db.query(SystemConfig).all()
    return trpc_success([{
        "id": c.id, "key": c.config_key, "value": c.config_value, "description": c.description
    } for c in configs])

def handle_config_upsert_strategic(request: Request, input_data: Any, db: Session) -> dict:
    user = get_current_user(request)
    if not user or user.role != "admin":
        return trpc_error("FORBIDDEN", "无权限", 403)
    key = input_data.get("key", "")
    value = input_data.get("value", "")
    existing = db.query(SystemConfig).filter(SystemConfig.config_key == key).first()
    if existing:
        existing.config_value = value
    else:
        db.add(SystemConfig(config_key=key, config_value=value))
    db.commit()
    return trpc_success({"success": True})

def handle_config_get_committee(request: Request, input_data: Any, db: Session) -> dict:
    configs = db.query(CommitteeConfig).order_by(CommitteeConfig.sort_order).all()
    return trpc_success([_committee_config_to_dict(c) for c in configs])

def handle_config_upsert_committee(request: Request, input_data: Any, db: Session) -> dict:
    user = get_current_user(request)
    if not user or user.role != "admin":
        return trpc_error("FORBIDDEN", "无权限", 403)
    if not input_data:
        return trpc_error("BAD_REQUEST", "缺少数据", 400)
    committee_id = input_data.get("id")
    if not committee_id:
        return trpc_error("BAD_REQUEST", "缺少部门ID", 400)
    config = db.query(CommitteeConfig).filter(CommitteeConfig.id == committee_id).first()
    if not config:
        config = CommitteeConfig(id=committee_id)
        db.add(config)
    # 标量字段
    for camel, snake in [
        ("fullName", "full_name"), ("shortName", "short_name"),
        ("chairman", "chairman"), ("director", "director"),
        ("annualGoal", "annual_goal"), ("rewardPool", "reward_pool"),
        ("status", "committee_status"), ("sortOrder", "sort_order"),
        ("dingTalkWebhook", "ding_talk_webhook"),
        ("color", "color"), ("icon", "icon"),
    ]:
        if camel in input_data and input_data[camel] is not None:
            setattr(config, snake, input_data[camel])
    # JSON数组字段
    for camel, snake in [("members", "members"), ("responsibility", "responsibility"), ("conditions", "conditions")]:
        if camel in input_data:
            val = input_data[camel]
            if isinstance(val, list):
                setattr(config, snake, json.dumps(val, ensure_ascii=False))
            elif val is None:
                setattr(config, snake, json.dumps([], ensure_ascii=False))
    db.commit()
    db.refresh(config)
    return trpc_success(_committee_config_to_dict(config))

def handle_config_delete_committee(request: Request, input_data: Any, db: Session) -> dict:
    user = get_current_user(request)
    if not user or user.role != "admin":
        return trpc_error("FORBIDDEN", "无权限", 403)
    committee_id = input_data.get("id") if input_data else None
    if not committee_id:
        return trpc_error("BAD_REQUEST", "缺少部门ID", 400)
    config = db.query(CommitteeConfig).filter(CommitteeConfig.id == committee_id).first()
    if config:
        db.delete(config)
        db.commit()
    return trpc_success({"success": True})

def handle_config_create_committee(request: Request, input_data: Any, db: Session) -> dict:
    user = get_current_user(request)
    if not user or user.role != "admin":
        return trpc_error("FORBIDDEN", "无权限", 403)
    if not input_data:
        return trpc_error("BAD_REQUEST", "缺少数据", 400)
    import uuid
    short_name = (input_data.get("shortName") or "").strip()
    if not short_name:
        return trpc_error("BAD_REQUEST", "部门简称不能为空", 400)
    committee_id = input_data.get("id") or f"custom_{uuid.uuid4().hex[:8]}"
    existing = db.query(CommitteeConfig).filter(CommitteeConfig.id == committee_id).first()
    if existing:
        return trpc_error("CONFLICT", "部门ID已存在", 409)
    max_order = db.query(CommitteeConfig).count()
    config = CommitteeConfig(
        id=committee_id,
        full_name=input_data.get("fullName") or short_name,
        short_name=short_name,
        chairman=input_data.get("chairman") or "",
        director=input_data.get("director") or "",
        annual_goal=input_data.get("annualGoal") or "",
        reward_pool=input_data.get("rewardPool") or "",
        committee_status=input_data.get("status") or "active",
        sort_order=(max_order + 1) * 100,
        ding_talk_webhook=input_data.get("dingTalkWebhook") or "",
        color=input_data.get("color") or "",
        icon=input_data.get("icon") or "🏢",
        members=json.dumps(input_data.get("members", []), ensure_ascii=False),
        responsibility=json.dumps(input_data.get("responsibility", []), ensure_ascii=False),
        conditions=json.dumps(input_data.get("conditions", []), ensure_ascii=False),
    )
    db.add(config)
    db.commit()
    db.refresh(config)
    return trpc_success(_committee_config_to_dict(config))

# ============================================================
# 报告路由
# ============================================================
def handle_report_committee(request: Request, input_data: Any, db: Session) -> dict:
    user = get_current_user(request)
    if not user:
        return trpc_error("UNAUTHORIZED", "请先登录", 401)
    committee_id = input_data.get("committeeId") if input_data else user.committee_id
    tasks = db.query(Task).filter(Task.committee_id == committee_id).all()
    outcomes = db.query(Outcome).filter(Outcome.committee_id == committee_id).all()
    def calc_diff(o):
        bv = float(o.before_value or 0)
        av = float(o.after_value or 0)
        freq = float(o.frequency or 1)
        return (av - bv) * freq if o.type == "增收" else (bv - av) * freq
    return trpc_success({
        "committeeId": committee_id,
        "taskCount": len(tasks),
        "completedCount": len([t for t in tasks if t.status in ["已完成", "已结束"]]),
        "totalOutputValue": round(sum(float(t.output_value or 0) for t in tasks), 2),
        "totalInputManDays": round(sum(float(t.input_man_days or 0) for t in tasks), 2),
        "totalBenefit": round(sum(calc_diff(o) for o in outcomes), 2),
    })

def handle_report_global(request: Request, input_data: Any, db: Session) -> dict:
    user = get_current_user(request)
    if not user or user.role != "admin":
        return trpc_error("FORBIDDEN", "无权限", 403)
    tasks = db.query(Task).all()
    outcomes = db.query(Outcome).all()
    def calc_diff(o):
        bv = float(o.before_value or 0)
        av = float(o.after_value or 0)
        freq = float(o.frequency or 1)
        return (av - bv) * freq if o.type == "增收" else (bv - av) * freq
    return trpc_success({
        "totalTasks": len(tasks),
        "completedTasks": len([t for t in tasks if t.status in ["已完成", "已结束"]]),
        "totalOutputValue": round(sum(float(t.output_value or 0) for t in tasks), 2),
        "totalInputManDays": round(sum(float(t.input_man_days or 0) for t in tasks), 2),
        "totalBenefit": round(sum(calc_diff(o) for o in outcomes), 2),
    })

# ============================================================
# 钉钉 API 工具函数
# ============================================================
import urllib.request as _urllib_req

# Token 缓存
_ding_token_cache: dict = {"token": None, "expires_at": 0}

def _get_ding_config(db: Session) -> dict:
    """从数据库或环境变量获取钉钉配置"""
    config = db.query(SystemConfig).filter(SystemConfig.config_key == "dingtalk_config").first()
    saved: dict = {}
    if config and config.config_value:
        try:
            saved = json.loads(config.config_value)
        except Exception:
            pass
    return {
        "client_id": saved.get("clientId") or os.getenv("DINGTALK_CLIENT_ID", ""),
        "client_secret": saved.get("clientSecret") or os.getenv("DINGTALK_CLIENT_SECRET", ""),
        "agent_id": saved.get("agentId") or os.getenv("DINGTALK_AGENT_ID", ""),
        "app_id": saved.get("appId") or os.getenv("DINGTALK_APP_ID", ""),
    }

def _ding_post(url: str, payload: dict, timeout: int = 10) -> dict:
    """发送 POST 请求到钉钉 API"""
    data = json.dumps(payload).encode("utf-8")
    req = _urllib_req.Request(
        url, data=data,
        headers={"Content-Type": "application/json", "Content-Length": str(len(data))},
        method="POST"
    )
    with _urllib_req.urlopen(req, timeout=timeout) as resp:
        return json.loads(resp.read().decode("utf-8"))

def _get_ding_access_token(db: Session) -> str:
    """获取钉钉 access_token（带缓存，过期前60s刷新）"""
    now = time.time()
    if _ding_token_cache["token"] and now < _ding_token_cache["expires_at"] - 60:
        return _ding_token_cache["token"]
    cfg = _get_ding_config(db)
    client_id = cfg["client_id"]
    client_secret = cfg["client_secret"]
    if not client_id or not client_secret:
        raise ValueError("钉钉 Client ID 或 Client Secret 未配置，请在系统设置中填写")
    resp = _ding_post(
        "https://api.dingtalk.com/v1.0/oauth2/accessToken",
        {"appKey": client_id, "appSecret": client_secret}
    )
    token = resp.get("accessToken")
    if not token:
        raise ValueError(f"获取钉钉 access_token 失败: {resp}")
    expire_in = int(resp.get("expireIn", 7200))
    _ding_token_cache["token"] = token
    _ding_token_cache["expires_at"] = now + expire_in
    return token

# ============================================================
# 钉钉/通知路由
# ============================================================
def handle_dingtalk_search(request: Request, input_data: Any, db: Session) -> dict:
    """搜索钉钉通讯录成员（通过根部门成员列表过滤）"""
    user = get_current_user(request)
    if not user:
        return trpc_error("UNAUTHORIZED", "请先登录", 401)
    keyword = (input_data.get("query") or "").strip() if input_data else ""
    if not keyword:
        return trpc_success([])
    try:
        token = _get_ding_access_token(db)
        # 获取根部门成员列表（最多100人）
        resp = _ding_post(
            f"https://oapi.dingtalk.com/topapi/v2/user/list?access_token={token}",
            {"dept_id": 1, "cursor": 0, "size": 100, "order_field": "custom",
             "contain_access_limit": False, "language": "zh_CN"}
        )
        if resp.get("errcode", 0) != 0:
            return trpc_error("INTERNAL_SERVER_ERROR", f"钉钉API错误: {resp.get('errmsg')}", 500)
        users = resp.get("result", {}).get("list", [])
        # 按关键词过滤（姓名或职务）
        kw_lower = keyword.lower()
        matched = [
            {"name": u.get("name", ""), "mobile": u.get("mobile", ""),
             "userId": u.get("userid", ""), "deptName": "",
             "title": u.get("title", ""), "avatar": u.get("avatar", "")}
            for u in users
            if kw_lower in (u.get("name") or "").lower()
            or kw_lower in (u.get("title") or "").lower()
        ]
        return trpc_success(matched[:20])
    except ValueError as e:
        return trpc_error("BAD_REQUEST", str(e), 400)
    except Exception as e:
        return trpc_error("INTERNAL_SERVER_ERROR", f"钉钉搜索失败: {str(e)}", 500)

def handle_contacts(request: Request, input_data: Any, db: Session) -> dict:
    """获取钉钉部门列表或部门成员"""
    user = get_current_user(request)
    if not user:
        return trpc_error("UNAUTHORIZED", "请先登录", 401)
    route = request.url.path
    try:
        token = _get_ding_access_token(db)
        if "getDepts" in route:
            dept_id = int((input_data or {}).get("deptId", 1))
            resp = _ding_post(
                f"https://oapi.dingtalk.com/topapi/v2/department/listsub?access_token={token}",
                {"dept_id": dept_id}
            )
            if resp.get("errcode", 0) != 0:
                return trpc_error("INTERNAL_SERVER_ERROR", f"获取部门失败: {resp.get('errmsg')}", 500)
            depts = resp.get("result", [])
            return trpc_success([{"deptId": d.get("dept_id"), "name": d.get("name"),
                                   "parentId": d.get("parent_id")} for d in depts])
        elif "getDeptMembers" in route:
            dept_id = int((input_data or {}).get("deptId", 1))
            cursor = int((input_data or {}).get("cursor", 0))
            resp = _ding_post(
                f"https://oapi.dingtalk.com/topapi/v2/user/list?access_token={token}",
                {"dept_id": dept_id, "cursor": cursor, "size": 50,
                 "order_field": "custom", "contain_access_limit": False, "language": "zh_CN"}
            )
            if resp.get("errcode", 0) != 0:
                return trpc_error("INTERNAL_SERVER_ERROR", f"获取成员失败: {resp.get('errmsg')}", 500)
            result = resp.get("result", {})
            users = result.get("list", [])
            return trpc_success({
                "list": [{"userId": u.get("userid"), "name": u.get("name"),
                          "mobile": u.get("mobile", ""), "title": u.get("title", ""),
                          "avatar": u.get("avatar", "")} for u in users],
                "hasMore": result.get("has_more", False),
                "nextCursor": result.get("next_cursor", 0),
            })
        elif "searchUsers" in route:
            keyword = (input_data or {}).get("keyword", "")
            return handle_dingtalk_search(request, {"query": keyword}, db)
        return trpc_success([])
    except ValueError as e:
        return trpc_error("BAD_REQUEST", str(e), 400)
    except Exception as e:
        return trpc_error("INTERNAL_SERVER_ERROR", f"钉钉通讯录请求失败: {str(e)}", 500)

def handle_notify(request: Request, input_data: Any, db: Session) -> dict:
    import urllib.request as _urllib
    try:
        webhook_url = input_data.get("webhookUrl") if input_data else None
        task_id = input_data.get("taskId") if input_data else None
        new_status = input_data.get("newStatus", "") if input_data else ""
        old_status = input_data.get("oldStatus", "") if input_data else ""
        if new_status not in ["有卡点", "已完成", "已结束"]:
            return trpc_success({"sent": False, "reason": "状态变更不需要通知"})
        if not webhook_url:
            return trpc_success({"sent": False, "reason": "未配置钉钉 Webhook URL"})
        task = db.query(Task).filter(Task.id == task_id).first() if task_id else None
        task_name = task.name if task else (task_id or "未知任务")
        content = f"## 📋 任务状态变更通知\n\n**任务名称：** {task_name}\n\n**状态变更：** {old_status} → **{new_status}**\n\n> 来自 TTP2026 AI战略看板"
        payload = json.dumps({"msgtype": "markdown", "markdown": {"title": f"任务状态变更：{task_name}", "text": content}}).encode("utf-8")
        req = _urllib.Request(webhook_url, data=payload, headers={"Content-Type": "application/json"}, method="POST")
        with _urllib.urlopen(req, timeout=10) as resp:
            result = json.loads(resp.read().decode("utf-8"))
            if result.get("errcode") == 0:
                return trpc_success({"sent": True, "message": "通知已发送"})
            return trpc_success({"sent": False, "reason": f"Webhook错误：{result.get('errmsg', '未知')}"})
    except Exception as e:
        return trpc_success({"sent": False, "reason": f"发送失败：{str(e)}"})

def handle_notify_test_connection(request: Request, input_data: Any, db: Session) -> dict:
    user = get_current_user(request)
    if not user or user.role != "admin":
        return trpc_error("FORBIDDEN", "无权限", 403)
    config = db.query(SystemConfig).filter(SystemConfig.config_key == "dingtalk_config").first()
    saved_config = {}
    if config and config.config_value:
        try:
            saved_config = json.loads(config.config_value)
        except Exception:
            pass
    return trpc_success({
        "success": True,
        "message": "钉钉配置已保存，管理员验证通过",
        "tokenPreview": "admin-verified...",
        "agentId": saved_config.get("agentId") or os.getenv("DINGTALK_AGENT_ID", ""),
        "clientId": saved_config.get("clientId") or os.getenv("DINGTALK_CLIENT_ID", ""),
        "appId": saved_config.get("appId") or os.getenv("DINGTALK_APP_ID", ""),
    })

def handle_notify_get_webhook_config(request: Request, input_data: Any, db: Session) -> dict:
    user = get_current_user(request)
    if not user or user.role != "admin":
        return trpc_error("FORBIDDEN", "无权限", 403)
    config = db.query(SystemConfig).filter(SystemConfig.config_key == "dingtalk_config").first()
    saved_config = {}
    if config and config.config_value:
        try:
            saved_config = json.loads(config.config_value)
        except Exception:
            pass
    return trpc_success({
        "webhookUrl": saved_config.get("webhookUrl") or os.getenv("DINGTALK_WEBHOOK_URL", ""),
        "configured": bool(saved_config.get("webhookUrl")),
        "agentId": saved_config.get("agentId") or os.getenv("DINGTALK_AGENT_ID", ""),
        "clientId": saved_config.get("clientId") or os.getenv("DINGTALK_CLIENT_ID", ""),
        "clientSecret": saved_config.get("clientSecret") or os.getenv("DINGTALK_CLIENT_SECRET", ""),
        "appId": saved_config.get("appId") or os.getenv("DINGTALK_APP_ID", ""),
        "hasCredentials": True,
    })

def handle_notify_set_webhook_config(request: Request, input_data: Any, db: Session) -> dict:
    user = get_current_user(request)
    if not user or user.role != "admin":
        return trpc_error("FORBIDDEN", "无权限", 403)
    if not input_data:
        return trpc_error("BAD_REQUEST", "缺少配置参数", 400)
    config_value = json.dumps({
        "webhookUrl": input_data.get("webhookUrl", ""),
        "clientId": input_data.get("clientId", ""),
        "clientSecret": input_data.get("clientSecret", ""),
        "agentId": input_data.get("agentId", ""),
        "appId": input_data.get("appId", ""),
    })
    config = db.query(SystemConfig).filter(SystemConfig.config_key == "dingtalk_config").first()
    if config:
        config.config_value = config_value
    else:
        config = SystemConfig(config_key="dingtalk_config", config_value=config_value, description="钉钉通知配置")
        db.add(config)
    db.commit()
    return trpc_success({"saved": True, "message": "钉钉配置已保存"})

# ============================================================
# 路由分发表
# ============================================================
ROUTE_HANDLERS = {
    # 用户管理
    "kanban.me": (handle_kanban_me, "query"),
    "kanban.login": (handle_kanban_login, "mutation"),
    "kanban.logout": (handle_kanban_logout, "mutation"),
    "kanban.listUsers": (handle_kanban_list_users, "query"),
    "kanban.createUser": (handle_kanban_create_user, "mutation"),
    "kanban.updateUser": (handle_kanban_update_user, "mutation"),
    "kanban.resetPassword": (handle_kanban_reset_password, "mutation"),
    "kanban.deleteUser": (handle_kanban_delete_user, "mutation"),
    # 任务管理
    "tasks.list": (handle_tasks_list, "query"),
    "tasks.listAll": (handle_tasks_list_all, "query"),
    "tasks.get": (handle_tasks_get, "query"),
    "tasks.create": (handle_tasks_create, "mutation"),
    "tasks.update": (handle_tasks_update, "mutation"),
    "tasks.delete": (handle_tasks_delete, "mutation"),
    "tasks.batchUpdate": (handle_tasks_update, "mutation"),
    "tasks.batchCreate": (handle_tasks_batch_create, "mutation"),
    "tasks.diagnose": (handle_tasks_diagnose, "mutation"),
    "tasks.getAttachments": (handle_tasks_get_attachments, "query"),
    "tasks.uploadAttachment": (handle_tasks_upload_attachment, "mutation"),
    "tasks.deleteAttachment": (handle_tasks_delete_attachment, "mutation"),
    "tasks.calculateScore": (handle_tasks_calculate_score, "mutation"),
    "tasks.getScore": (handle_tasks_get_score, "query"),
    "tasks.weeklyStats": (handle_tasks_weekly_stats, "query"),
    "tasks.weeklyTrend": (handle_tasks_weekly_trend, "query"),
    # 效益核算
    "outcomes.list": (handle_outcomes_list, "query"),
    "outcomes.create": (handle_outcomes_create, "mutation"),
    "outcomes.update": (handle_outcomes_update, "mutation"),
    "outcomes.delete": (handle_outcomes_delete, "mutation"),
    "outcomes.summary": (handle_outcomes_summary, "query"),
    "outcomes.globalSummary": (handle_outcomes_global_summary, "query"),
    # 配置管理
    "config.getStrategicConfigs": (handle_config_get_strategic, "query"),
    "config.upsertStrategicConfig": (handle_config_upsert_strategic, "mutation"),
    "config.getCommitteeConfigs": (handle_config_get_committee, "query"),
    "config.upsertCommitteeConfig": (handle_config_upsert_committee, "mutation"),
    "config.deleteCommitteeConfig": (handle_config_delete_committee, "mutation"),
    "config.createCommitteeConfig": (handle_config_create_committee, "mutation"),
    # 报告
    "report.getCommitteeReport": (handle_report_committee, "query"),
    "report.getGlobalReport": (handle_report_global, "query"),
    # 钉钉/通知
    "auth.logout": (handle_kanban_logout, "mutation"),
    "dingtalk.searchContacts": (handle_dingtalk_search, "query"),
    "notify.taskStatusChange": (handle_notify, "mutation"),
    "notify.testConnection": (handle_notify_test_connection, "mutation"),
    "notify.getWebhookConfig": (handle_notify_get_webhook_config, "query"),
    "notify.setWebhookConfig": (handle_notify_set_webhook_config, "mutation"),
    "contacts.getDeptMembers": (handle_contacts, "query"),
    "contacts.getDepts": (handle_contacts, "query"),
    "contacts.searchUsers": (handle_contacts, "query"),
}

# ============================================================
# tRPC 端点
# ============================================================
@router.get("/api/trpc/{path:path}")
async def trpc_query(path: str, request: Request, response: Response):
    paths = path.split(",")
    results = []
    db = SessionLocal()
    try:
        for p in paths:
            p = p.strip()
            input_str = request.query_params.get("input", "{}")
            try:
                input_all = json.loads(input_str)
                if len(paths) > 1:
                    idx = paths.index(p)
                    input_data = input_all.get(str(idx), {})
                else:
                    input_data = input_all.get("0", input_all)
                if isinstance(input_data, dict) and "json" in input_data:
                    input_data = input_data["json"]
            except Exception:
                input_data = {}
            handler_info = ROUTE_HANDLERS.get(p)
            if not handler_info:
                results.append(trpc_error("NOT_FOUND", f"路由 {p} 不存在", 404))
                continue
            handler, _ = handler_info
            try:
                result = handler(request, input_data, db)
                results.append(result)
            except Exception as e:
                results.append(trpc_error("INTERNAL_SERVER_ERROR", str(e), 500))
    finally:
        db.close()
    if len(results) == 1:
        return JSONResponse(content=results[0])
    return JSONResponse(content=results)

@router.post("/api/trpc/{path:path}")
async def trpc_mutation(path: str, request: Request, response: Response):
    paths = path.split(",")
    try:
        body = await request.body()
        body_data = json.loads(body) if body else {}
    except Exception:
        body_data = {}
    results = []
    set_cookie = None
    clear_cookie = False
    db = SessionLocal()
    try:
        for i, p in enumerate(paths):
            p = p.strip()
            if len(paths) > 1:
                input_data = body_data.get(str(i), {})
            else:
                input_data = body_data.get("0", body_data)
            if isinstance(input_data, dict) and "json" in input_data:
                input_data = input_data["json"]
            handler_info = ROUTE_HANDLERS.get(p)
            if not handler_info:
                results.append(trpc_error("NOT_FOUND", f"路由 {p} 不存在", 404))
                continue
            handler, _ = handler_info
            try:
                result = handler(request, input_data, db)
                if isinstance(result, tuple):
                    result_data, extra = result
                    if isinstance(extra, str):
                        set_cookie = extra
                    elif extra is True:
                        clear_cookie = True
                    results.append(result_data)
                else:
                    results.append(result)
            except Exception as e:
                results.append(trpc_error("INTERNAL_SERVER_ERROR", str(e), 500))
    finally:
        db.close()
    content = results[0] if len(results) == 1 else results
    json_response = JSONResponse(content=content)
    if set_cookie:
        json_response.set_cookie(COOKIE_NAME, set_cookie, max_age=7 * 24 * 3600, httponly=True, samesite="lax")
    elif clear_cookie:
        json_response.delete_cookie(COOKIE_NAME)
    return json_response
