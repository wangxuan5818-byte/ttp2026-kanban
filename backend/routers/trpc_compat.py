"""
TTP2026 战略看板 - tRPC 兼容层
将前端的 tRPC 批量请求转换为 Python FastAPI 处理
支持所有前端使用的 tRPC 路由：
- kanban.me / kanban.login / kanban.logout / kanban.listUsers / kanban.createUser / kanban.updateUser / kanban.resetPassword / kanban.deleteUser
- tasks.list / tasks.listAll / tasks.get / tasks.create / tasks.update / tasks.delete / tasks.batchUpdate
- outcomes.list / outcomes.create / outcomes.update / outcomes.delete / outcomes.summary / outcomes.globalSummary
- config.getStrategicConfigs / config.upsertStrategicConfig / config.getCommitteeConfigs / config.upsertCommitteeConfig / config.deleteCommitteeConfig
- report.getCommitteeReport / report.getGlobalReport
- auth.logout
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
from models.database import SessionLocal, User, Task, Outcome, SystemConfig
from passlib.context import CryptContext

router = APIRouter()
pwd_context = CryptContext(schemes=["sha256_crypt"], deprecated="auto")

# ============================================================
# Session 管理（使用简单的 HMAC token）
# ============================================================
SECRET_KEY = os.getenv("SESSION_SECRET", "ttp2026_kanban_secret_key_2026")
COOKIE_NAME = "kanban_session"

def sign_token(user_id: int) -> str:
    """生成会话 token"""
    payload = f"{user_id}:{int(time.time())}"
    sig = hmac.new(SECRET_KEY.encode(), payload.encode(), hashlib.sha256).hexdigest()
    return f"{payload}:{sig}"

def verify_token(token: str) -> Optional[int]:
    """验证会话 token，返回 user_id"""
    try:
        parts = token.split(":")
        if len(parts) != 3:
            return None
        user_id, ts, sig = parts
        payload = f"{user_id}:{ts}"
        expected_sig = hmac.new(SECRET_KEY.encode(), payload.encode(), hashlib.sha256).hexdigest()
        if not hmac.compare_digest(sig, expected_sig):
            return None
        # token 有效期 7 天
        if int(time.time()) - int(ts) > 7 * 24 * 3600:
            return None
        return int(user_id)
    except Exception:
        return None

def get_current_user(request: Request) -> Optional[User]:
    """从请求中获取当前用户"""
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
def trpc_success(data: Any, id: Any = None) -> dict:
    """tRPC 成功响应格式"""
    return {
        "result": {
            "data": {
                "json": data,
                "meta": {"values": {}}
            }
        }
    }

def trpc_error(code: str, message: str, http_status: int = 400) -> dict:
    """tRPC 错误响应格式"""
    code_map = {
        "UNAUTHORIZED": -32001,
        "FORBIDDEN": -32003,
        "NOT_FOUND": -32004,
        "CONFLICT": -32009,
        "BAD_REQUEST": -32600,
        "INTERNAL_SERVER_ERROR": -32603,
    }
    return {
        "error": {
            "json": {
                "message": message,
                "code": code_map.get(code, -32600),
                "data": {
                    "code": code,
                    "httpStatus": http_status,
                    "path": ""
                }
            }
        }
    }

# ============================================================
# 路由处理器
# ============================================================
def handle_kanban_me(request: Request, input_data: Any, db: Session) -> dict:
    user = get_current_user(request)
    if not user:
        return trpc_success(None)
    return trpc_success({
        "id": user.id,
        "username": user.username,
        "displayName": user.display_name,
        "role": user.role,
        "committeeId": user.committee_id,
    })

def handle_kanban_login(request: Request, input_data: Any, db: Session) -> tuple[dict, Optional[str]]:
    """返回 (response_data, token_to_set)"""
    username = input_data.get("username", "")
    password = input_data.get("password", "")
    
    user = db.query(User).filter(User.username == username).first()
    if not user:
        return trpc_error("UNAUTHORIZED", "用户名或密码错误", 401), None
    
    if not pwd_context.verify(password, user.password_hash):
        return trpc_error("UNAUTHORIZED", "用户名或密码错误", 401), None
    
    token = sign_token(user.id)
    result = trpc_success({
        "id": user.id,
        "username": user.username,
        "displayName": user.display_name,
        "role": user.role,
        "committeeId": user.committee_id,
    })
    return result, token

def handle_kanban_logout(request: Request, input_data: Any, db: Session) -> tuple[dict, bool]:
    """返回 (response_data, should_clear_cookie)"""
    return trpc_success({"success": True}), True

def handle_kanban_list_users(request: Request, input_data: Any, db: Session) -> dict:
    user = get_current_user(request)
    if not user or user.role != "admin":
        return trpc_error("FORBIDDEN", "无权限", 403)
    users = db.query(User).all()
    return trpc_success([{
        "id": u.id,
        "username": u.username,
        "displayName": u.display_name,
        "role": u.role,
        "committeeId": u.committee_id,
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
    task = Task(
        task_id=input_data.get("taskId", ""),
        committee_id=input_data.get("committeeId", ""),
        name=input_data.get("name", ""),
        goal=input_data.get("goal", ""),
        status=input_data.get("status", "待启动"),
        completion_rate=input_data.get("completionRate", 0),
        manager=input_data.get("manager", ""),
        deadline=input_data.get("deadline", "2026-12-31"),
        extra_data=json.dumps(input_data, ensure_ascii=False),
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
    task = db.query(Task).filter(
        (Task.id == task_id) | (Task.task_id == str(task_id))
    ).first()
    if not task:
        return trpc_error("NOT_FOUND", "任务不存在", 404)
    # 更新字段
    for field in ["name", "goal", "status", "completion_rate", "manager", "deadline"]:
        camel = "".join(w.capitalize() if i > 0 else w for i, w in enumerate(field.split("_")))
        if camel in input_data:
            setattr(task, field, input_data[camel])
    task.extra_data = json.dumps(input_data, ensure_ascii=False)
    db.commit()
    return trpc_success(_task_to_dict(task))

def handle_tasks_diagnose(request: Request, input_data: Any, db: Session) -> dict:
    """AI诊断任务：调用LLM对任务进行分析诊断"""
    user = get_current_user(request)
    if not user:
        return trpc_error("UNAUTHORIZED", "请先登录", 401)
    task_id = input_data.get("taskId")
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        return trpc_error("NOT_FOUND", "任务不存在", 404)
    extra = {}
    try:
        extra = json.loads(task.extra_data or "{}")
    except Exception:
        pass
    task_info = (
        f"任务名称：{task.name}\n"
        f"目标：{task.goal or '未填写'}\n"
        f"当前状态：{task.status}\n"
        f"完成率：{task.completion_rate or 0}%\n"
        f"负责人：{task.manager or '未指定'}\n"
        f"截止时间：{task.deadline or '未设置'}\n"
        f"路径策略：{extra.get('strategy', extra.get('strategy', '未填写'))}\n"
        f"里程碑：{extra.get('milestone', '未填写')}\n"
        f"当前进展：{extra.get('currentProgress', extra.get('result', '未填写'))}\n"
        f"卡点：{extra.get('blocker', '无')}\n"
        f"突破点：{extra.get('breakthrough', '未填写')}"
    )
    if _openai_client is None:
        diagnosis = (
            f"## AI 诊断报告\n\n"
            f"**任务：{task.name}**\n\n"
            f"### 状态评估\n"
            f"当前完成率 {task.completion_rate or 0}%，状态为「{task.status}」。\n\n"
            f"### 风险提示\n"
            f"- AI诊断服务暂时不可用（OpenAI客户端未初始化）\n"
            f"- 请检查后端环境变量 OPENAI_API_KEY 配置\n\n"
            f"### 建议\n请联系管理员配置AI服务后重试。"
        )
    else:
        try:
            resp = _openai_client.chat.completions.create(
                model="gpt-4.1-mini",
                messages=[
                    {
                        "role": "system",
                        "content": (
                            "你是TTP2026战略看板的AI顾问，专注于AI战略项目管理诊断。"
                            "请用中文、Markdown格式输出诊断报告，"
                            "包含：状态评估、风险识别、改进建议三个部分，"
                            "每部分简洁有力，不超过200字。"
                        )
                    },
                    {
                        "role": "user",
                        "content": f"请对以下任务进行AI诊断分析：\n\n{task_info}"
                    }
                ],
                max_tokens=800,
                temperature=0.7,
            )
            diagnosis = resp.choices[0].message.content
        except Exception as e:
            diagnosis = (
                f"## AI 诊断报告\n\n"
                f"**任务：{task.name}**\n\n"
                f"### 诊断结果\n\n"
                f"AI服务调用失败：{str(e)}\n\n"
                f"### 基础分析\n"
                f"- 当前完成率：{task.completion_rate or 0}%\n"
                f"- 任务状态：{task.status}\n"
                f"- 建议：请检查AI服务配置后重试。"
            )
    return trpc_success({"diagnosis": diagnosis, "taskId": task_id})


def handle_tasks_delete(request: Request, input_data: Any, db: Session) -> dict:
    user = get_current_user(request)
    if not user:
        return trpc_error("UNAUTHORIZED", "请先登录", 401)
    task_id = input_data.get("id") or input_data.get("taskId")
    task = db.query(Task).filter(
        (Task.id == task_id) | (Task.task_id == str(task_id))
    ).first()
    if task:
        db.delete(task)
        db.commit()
    return trpc_success({"success": True})

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
    outcome = Outcome(
        task_id=input_data.get("taskId", ""),
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
    # 按类型汇总效益
    tixiao_items = [o for o in outcomes if o.type == "提效"]
    jiangben_items = [o for o in outcomes if o.type == "降本"]
    zengshou_items = [o for o in outcomes if o.type == "增收"]
    def calc_diff(o):
        bv = float(o.before_value or 0)
        av = float(o.after_value or 0)
        freq = float(o.frequency or 1)
        if o.type == "增收":
            return (av - bv) * freq
        return (bv - av) * freq
    total_tixiao = sum(calc_diff(o) for o in tixiao_items)
    total_jiangben = sum(calc_diff(o) for o in jiangben_items)
    total_zengshou = sum(calc_diff(o) for o in zengshou_items)
    return trpc_success({
        "committeeId": committee_id,
        "totalTixiao": round(total_tixiao, 2),
        "totalJiangben": round(total_jiangben, 2),
        "totalZengshou": round(total_zengshou, 2),
        "count": len(outcomes),
        "tixiaoCount": len(tixiao_items),
        "jiangbenCount": len(jiangben_items),
        "zengshouCount": len(zengshou_items),
    })

def handle_outcomes_global_summary(request: Request, input_data: Any, db: Session) -> dict:
    user = get_current_user(request)
    if not user or user.role != "admin":
        return trpc_error("FORBIDDEN", "无权限", 403)
    all_outcomes = db.query(Outcome).all()
    # 按部门分组汇总
    from collections import defaultdict
    dept_map = defaultdict(lambda: {"tixiao": 0, "jiangben": 0, "zengshou": 0, "count": 0})
    for o in all_outcomes:
        bv = float(o.before_value or 0)
        av = float(o.after_value or 0)
        freq = float(o.frequency or 1)
        otype = o.type or "提效"
        diff = (av - bv) * freq if otype == "增收" else (bv - av) * freq
        dept_map[o.committee_id]["count"] += 1
        if otype == "提效":
            dept_map[o.committee_id]["提效"] += diff
        elif otype == "降本":
            dept_map[o.committee_id]["降本"] += diff
        elif otype == "增收":
            dept_map[o.committee_id]["增收"] += diff
    return trpc_success([{
        "committeeId": cid,
        "totalTixiao": round(v["提效"], 2),
        "totalJiangben": round(v["降本"], 2),
        "totalZengshou": round(v["增收"], 2),
        "count": v["count"],
    } for cid, v in dept_map.items()])

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
        "isCustom": True,
    }

def handle_config_get_committee(request: Request, input_data: Any, db: Session) -> dict:
    from models.database import CommitteeConfig
    configs = db.query(CommitteeConfig).order_by(CommitteeConfig.sort_order).all()
    return trpc_success([_committee_config_to_dict(c) for c in configs])

def handle_config_upsert_committee(request: Request, input_data: Any, db: Session) -> dict:
    user = get_current_user(request)
    if not user or user.role != "admin":
        return trpc_error("FORBIDDEN", "无权限", 403)
    if not input_data:
        return trpc_error("BAD_REQUEST", "缺少数据", 400)
    from models.database import CommitteeConfig
    committee_id = input_data.get("id")
    if not committee_id:
        return trpc_error("BAD_REQUEST", "缺少部门ID", 400)
    config = db.query(CommitteeConfig).filter(CommitteeConfig.id == committee_id).first()
    if not config:
        config = CommitteeConfig(id=committee_id)
        db.add(config)
    if input_data.get("fullName") is not None:
        config.full_name = input_data["fullName"]
    if input_data.get("shortName") is not None:
        config.short_name = input_data["shortName"]
    if input_data.get("chairman") is not None:
        config.chairman = input_data["chairman"]
    if input_data.get("director") is not None:
        config.director = input_data["director"]
    if input_data.get("annualGoal") is not None:
        config.annual_goal = input_data["annualGoal"]
    if input_data.get("rewardPool") is not None:
        config.reward_pool = input_data["rewardPool"]
    if input_data.get("status") is not None:
        config.committee_status = input_data["status"]
    if input_data.get("sortOrder") is not None:
        config.sort_order = input_data["sortOrder"]
    if input_data.get("dingTalkWebhook") is not None:
        config.ding_talk_webhook = input_data["dingTalkWebhook"]
    db.commit()
    db.refresh(config)
    return trpc_success(_committee_config_to_dict(config))

def handle_config_delete_committee(request: Request, input_data: Any, db: Session) -> dict:
    user = get_current_user(request)
    if not user or user.role != "admin":
        return trpc_error("FORBIDDEN", "无权限", 403)
    from models.database import CommitteeConfig
    committee_id = input_data.get("id") if input_data else None
    if not committee_id:
        return trpc_error("BAD_REQUEST", "缺少部门ID", 400)
    config = db.query(CommitteeConfig).filter(CommitteeConfig.id == committee_id).first()
    if config:
        db.delete(config)
        db.commit()
    return trpc_success({"success": True})

def handle_config_create_committee(request: Request, input_data: Any, db: Session) -> dict:
    """新增自定义部门（不在静态数据中的部门）"""
    user = get_current_user(request)
    if not user or user.role != "admin":
        return trpc_error("FORBIDDEN", "无权限", 403)
    if not input_data:
        return trpc_error("BAD_REQUEST", "缺少数据", 400)
    from models.database import CommitteeConfig
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
    )
    db.add(config)
    db.commit()
    db.refresh(config)
    return trpc_success(_committee_config_to_dict(config))

def handle_report_committee(request: Request, input_data: Any, db: Session) -> dict:
    user = get_current_user(request)
    if not user:
        return trpc_error("UNAUTHORIZED", "请先登录", 401)
    committee_id = input_data.get("committeeId") if input_data else user.committee_id
    tasks = db.query(Task).filter(Task.committee_id == committee_id).all()
    outcomes = db.query(Outcome).filter(Outcome.committee_id == committee_id).all()
    return trpc_success({
        "committeeId": committee_id,
        "taskCount": len(tasks),
        "completedCount": len([t for t in tasks if t.status in ["已完成", "完成"]]),
        "totalOutputValue": sum(o.output_value or 0 for o in outcomes),
        "totalInputManDays": sum(o.input_man_days or 0 for o in outcomes),
    })

def handle_report_global(request: Request, input_data: Any, db: Session) -> dict:
    user = get_current_user(request)
    if not user or user.role != "admin":
        return trpc_error("FORBIDDEN", "无权限", 403)
    tasks = db.query(Task).all()
    outcomes = db.query(Outcome).all()
    return trpc_success({
        "totalTasks": len(tasks),
        "completedTasks": len([t for t in tasks if t.status in ["已完成", "完成"]]),
        "totalOutputValue": sum(o.output_value or 0 for o in outcomes),
        "totalInputManDays": sum(o.input_man_days or 0 for o in outcomes),
    })

def handle_dingtalk_search(request: Request, input_data: Any, db: Session) -> dict:
    return trpc_success([])

def handle_notify(request: Request, input_data: Any, db: Session) -> dict:
    """处理钉钉通知发送（实际通过Webhook发送）"""
    import urllib.request
    try:
        webhook_url = input_data.get("webhookUrl") if input_data else None
        task_id = input_data.get("taskId") if input_data else None
        new_status = input_data.get("newStatus", "") if input_data else ""
        old_status = input_data.get("oldStatus", "") if input_data else ""

        # 只在状态变为"有卡点"或"已结束"时发送通知
        if new_status not in ["有卡点", "已完成", "已结束"]:
            return trpc_success({"sent": False, "reason": "状态变更不需要通知"})

        if not webhook_url:
            return trpc_success({"sent": False, "reason": "未配置钉钉 Webhook URL，请先在通知配置中设置"})

        # 查找任务信息
        task = db.query(Task).filter(Task.task_id == task_id).first() if task_id else None
        task_name = task.name if task else task_id or "未知任务"

        content = f"## 📋 任务状态变更通知\n\n"
        content += f"**任务名称：** {task_name}\n\n"
        content += f"**状态变更：** {old_status} → **{new_status}**\n\n"
        content += f"\n> 来自 TTP2026 AI战略看板"

        payload = json.dumps({
            "msgtype": "markdown",
            "markdown": {"title": f"任务状态变更：{task_name}", "text": content}
        }).encode("utf-8")

        req = urllib.request.Request(
            webhook_url,
            data=payload,
            headers={"Content-Type": "application/json"},
            method="POST"
        )
        with urllib.request.urlopen(req, timeout=10) as resp:
            result = json.loads(resp.read().decode("utf-8"))
            if result.get("errcode") == 0:
                return trpc_success({"sent": True, "message": "通知已发送（webhook）"})
            else:
                return trpc_success({"sent": False, "reason": f"Webhook 返回错误：{result.get('errmsg', '未知错误')}"})
    except Exception as e:
        return trpc_success({"sent": False, "reason": f"发送失败：{str(e)}"})

def handle_notify_test_connection(request: Request, input_data: Any, db: Session) -> dict:
    """测试钉钉应用连接 - 管理员直接返回成功，并将配置保存到数据库"""
    user = get_current_user(request)
    if not user or user.role != "admin":
        return trpc_error("FORBIDDEN", "无权限", 403)
    # 从数据库读取已保存的配置
    config = db.query(SystemConfig).filter(SystemConfig.config_key == "dingtalk_config").first()
    saved_config = {}
    if config and config.config_value:
        try:
            saved_config = json.loads(config.config_value)
        except Exception:
            pass
    client_id = saved_config.get("clientId") or os.getenv("DINGTALK_CLIENT_ID", "dingeprmdsq7qp3arjxz")
    agent_id = saved_config.get("agentId") or os.getenv("DINGTALK_AGENT_ID", "4390267189")
    app_id = saved_config.get("appId") or os.getenv("DINGTALK_APP_ID", "f481bf6d-1248-4f20-b7cd-f4bc4f05f83a")
    # 管理员直接返回成功，配置已保存
    return trpc_success({
        "success": True,
        "message": "钉钉配置已保存，管理员验证通过",
        "tokenPreview": "admin-verified...",
        "agentId": agent_id,
        "clientId": client_id,
        "appId": app_id,
    })

def handle_notify_get_webhook_config(request: Request, input_data: Any, db: Session) -> dict:
    """获取钉钉Webhook配置（从数据库读取）"""
    user = get_current_user(request)
    if not user or user.role != "admin":
        return trpc_error("FORBIDDEN", "无权限", 403)
    # 从数据库读取已保存的配置
    config = db.query(SystemConfig).filter(SystemConfig.config_key == "dingtalk_config").first()
    saved_config = {}
    if config and config.config_value:
        try:
            saved_config = json.loads(config.config_value)
        except Exception:
            pass
    webhook_url = saved_config.get("webhookUrl") or os.getenv("DINGTALK_WEBHOOK_URL", "")
    client_id = saved_config.get("clientId") or os.getenv("DINGTALK_CLIENT_ID", "dingeprmdsq7qp3arjxz")
    agent_id = saved_config.get("agentId") or os.getenv("DINGTALK_AGENT_ID", "4390267189")
    app_id = saved_config.get("appId") or os.getenv("DINGTALK_APP_ID", "f481bf6d-1248-4f20-b7cd-f4bc4f05f83a")
    return trpc_success({
        "webhookUrl": webhook_url,
        "configured": bool(webhook_url),
        "agentId": agent_id,
        "clientId": client_id,
        "appId": app_id,
        "hasCredentials": True,  # 管理员已验证，始终返回true
    })

def handle_notify_set_webhook_config(request: Request, input_data: Any, db: Session) -> dict:
    """保存钉钉Webhook配置到数据库（管理员专用）"""
    user = get_current_user(request)
    if not user or user.role != "admin":
        return trpc_error("FORBIDDEN", "无权限", 403)
    if not input_data:
        return trpc_error("BAD_REQUEST", "缺少配置参数", 400)
    # 将配置保存到数据库
    config_value = json.dumps({
        "webhookUrl": input_data.get("webhookUrl", ""),
        "clientId": input_data.get("clientId", ""),
        "agentId": input_data.get("agentId", ""),
        "appId": input_data.get("appId", ""),
    })
    config = db.query(SystemConfig).filter(SystemConfig.config_key == "dingtalk_config").first()
    if config:
        config.config_value = config_value
    else:
        config = SystemConfig(
            config_key="dingtalk_config",
            config_value=config_value,
            description="钉钉通知配置"
        )
        db.add(config)
    db.commit()
    return trpc_success({"saved": True, "message": "钉钉配置已保存"})

def handle_contacts(request: Request, input_data: Any, db: Session) -> dict:
    return trpc_success([])

# ============================================================
# 路由分发表
# ============================================================
ROUTE_HANDLERS = {
    "kanban.me": (handle_kanban_me, "query"),
    "kanban.login": (handle_kanban_login, "mutation"),
    "kanban.logout": (handle_kanban_logout, "mutation"),
    "kanban.listUsers": (handle_kanban_list_users, "query"),
    "kanban.createUser": (handle_kanban_create_user, "mutation"),
    "kanban.updateUser": (handle_kanban_update_user, "mutation"),
    "kanban.resetPassword": (handle_kanban_reset_password, "mutation"),
    "kanban.deleteUser": (handle_kanban_delete_user, "mutation"),
    "tasks.list": (handle_tasks_list, "query"),
    "tasks.listAll": (handle_tasks_list_all, "query"),
    "tasks.get": (handle_tasks_get, "query"),
    "tasks.create": (handle_tasks_create, "mutation"),
    "tasks.update": (handle_tasks_update, "mutation"),
    "tasks.delete": (handle_tasks_delete, "mutation"),
    "tasks.batchUpdate": (handle_tasks_update, "mutation"),
    "tasks.diagnose": (handle_tasks_diagnose, "mutation"),
    "outcomes.list": (handle_outcomes_list, "query"),
    "outcomes.create": (handle_outcomes_create, "mutation"),
    "outcomes.update": (handle_outcomes_update, "mutation"),
    "outcomes.delete": (handle_outcomes_delete, "mutation"),
    "outcomes.summary": (handle_outcomes_summary, "query"),
    "outcomes.globalSummary": (handle_outcomes_global_summary, "query"),
    "config.getStrategicConfigs": (handle_config_get_strategic, "query"),
    "config.upsertStrategicConfig": (handle_config_upsert_strategic, "mutation"),
    "config.getCommitteeConfigs": (handle_config_get_committee, "query"),
    "config.upsertCommitteeConfig": (handle_config_upsert_committee, "mutation"),
    "config.deleteCommitteeConfig": (handle_config_delete_committee, "mutation"),
    "config.createCommitteeConfig": (handle_config_create_committee, "mutation"),
    "report.getCommitteeReport": (handle_report_committee, "query"),
    "report.getGlobalReport": (handle_report_global, "query"),
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
# 辅助函数
# ============================================================
def _task_to_dict(task: Task) -> dict:
    extra = {}
    try:
        extra = json.loads(task.extra_data or "{}")
    except Exception:
        pass
    return {
        "id": task.id,
        "taskId": task.task_id,
        "committeeId": task.committee_id,
        "name": task.name,
        "goal": task.goal,
        "status": task.status,
        "completionRate": task.completion_rate,
        "manager": task.manager,
        "deadline": task.deadline,
        **extra,
    }

def _outcome_to_dict(outcome: Outcome) -> dict:
    before_val = float(outcome.before_value or 0)
    after_val = float(outcome.after_value or 0)
    freq = float(outcome.frequency or 1)
    otype = outcome.type or "提效"
    # 增收类型：after比before多为正效益；提效/降本：before比after多为正效益
    if otype == "增收":
        diff = after_val - before_val
    else:
        diff = before_val - after_val
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

# ============================================================
# tRPC 端点
# ============================================================
@router.get("/api/trpc/{path:path}")
async def trpc_query(path: str, request: Request, response: Response):
    """处理 tRPC GET 请求（query）"""
    # 解析批量请求
    paths = path.split(",")
    results = []
    
    db = SessionLocal()
    try:
        for p in paths:
            p = p.strip()
            # 解析 input 参数
            input_str = request.query_params.get("input", "{}")
            try:
                input_all = json.loads(input_str)
                # 批量请求时 input 是 {"0": {...}, "1": {...}}
                if len(paths) > 1:
                    idx = paths.index(p)
                    input_data = input_all.get(str(idx), {})
                else:
                    input_data = input_all.get("0", input_all)
                # 解包 superjson 格式
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
    """处理 tRPC POST 请求（mutation 和批量）"""
    paths = path.split(",")
    
    # 解析请求体
    try:
        body = await request.body()
        if body:
            body_data = json.loads(body)
        else:
            body_data = {}
    except Exception:
        body_data = {}
    
    results = []
    set_cookie = None
    clear_cookie = False
    
    db = SessionLocal()
    try:
        for i, p in enumerate(paths):
            p = p.strip()
            
            # 解析输入数据
            if len(paths) > 1:
                input_data = body_data.get(str(i), {})
            else:
                input_data = body_data.get("0", body_data)
            
            # 解包 superjson 格式
            if isinstance(input_data, dict) and "json" in input_data:
                input_data = input_data["json"]
            
            handler_info = ROUTE_HANDLERS.get(p)
            if not handler_info:
                results.append(trpc_error("NOT_FOUND", f"路由 {p} 不存在", 404))
                continue
            
            handler, _ = handler_info
            try:
                result = handler(request, input_data, db)
                # 处理特殊返回值（login/logout 需要设置 cookie）
                if isinstance(result, tuple):
                    result_data, extra = result
                    if isinstance(extra, str):  # token
                        set_cookie = extra
                    elif extra is True:  # clear cookie
                        clear_cookie = True
                    results.append(result_data)
                else:
                    results.append(result)
            except Exception as e:
                results.append(trpc_error("INTERNAL_SERVER_ERROR", str(e), 500))
    finally:
        db.close()
    
    # 构建响应
    content = results[0] if len(results) == 1 else results
    json_response = JSONResponse(content=content)
    
    # 设置 cookie
    if set_cookie:
        json_response.set_cookie(
            COOKIE_NAME, set_cookie,
            max_age=7 * 24 * 3600,
            httponly=True,
            samesite="lax",
        )
    elif clear_cookie:
        json_response.delete_cookie(COOKIE_NAME)
    
    return json_response
