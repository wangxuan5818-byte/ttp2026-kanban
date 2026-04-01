"""
TTP2026 AI Agent 路由
支持自然语言操作看板数据，流式 SSE 输出
"""
import os
import json
import uuid
from typing import AsyncGenerator, Optional
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from openai import AsyncOpenAI

from models.database import SessionLocal, Task, User
from routers.auth import require_auth

router = APIRouter(prefix="/api/agent", tags=["agent"])

# ==================== OpenAI 客户端 ====================

def get_openai_client():
    api_key = os.environ.get("OPENAI_API_KEY")
    base_url = os.environ.get("OPENAI_BASE_URL", "https://api.openai.com/v1")
    if not api_key:
        raise HTTPException(status_code=500, detail="OPENAI_API_KEY 未配置")
    return AsyncOpenAI(api_key=api_key, base_url=base_url)

# ==================== 工具定义 ====================

TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "get_task_stats",
            "description": "获取任务统计数据，包括各状态任务数量",
            "parameters": {"type": "object", "properties": {}, "required": []},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "list_tasks",
            "description": "获取任务列表，可按部门、状态筛选",
            "parameters": {
                "type": "object",
                "properties": {
                    "committee_id": {
                        "type": "string",
                        "description": "部门ID，如 qianwei、huojunjun、yanwei 等，不传则返回所有",
                    },
                    "status": {
                        "type": "string",
                        "enum": ["进行中", "已完成", "待启动", "有卡点", "已结束"],
                        "description": "任务状态筛选",
                    },
                    "limit": {
                        "type": "integer",
                        "description": "返回数量限制，默认20",
                        "default": 20,
                    },
                },
                "required": [],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_task",
            "description": "获取单个任务的详细信息",
            "parameters": {
                "type": "object",
                "properties": {
                    "task_id": {"type": "string", "description": "任务ID"},
                },
                "required": ["task_id"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "update_task",
            "description": "更新任务信息，如完成率、状态、负责人等",
            "parameters": {
                "type": "object",
                "properties": {
                    "task_id": {"type": "string", "description": "任务ID"},
                    "status": {
                        "type": "string",
                        "enum": ["进行中", "已完成", "待启动", "有卡点", "已结束"],
                        "description": "新状态",
                    },
                    "completion_rate": {
                        "type": "integer",
                        "description": "完成率 0-100",
                        "minimum": 0,
                        "maximum": 100,
                    },
                    "manager": {"type": "string", "description": "负责人"},
                    "result": {"type": "string", "description": "阶段成果"},
                    "breakthrough": {"type": "string", "description": "突破点/卡点说明"},
                },
                "required": ["task_id"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "create_task",
            "description": "创建新任务",
            "parameters": {
                "type": "object",
                "properties": {
                    "name": {"type": "string", "description": "任务名称"},
                    "committee_id": {"type": "string", "description": "所属部门ID"},
                    "status": {
                        "type": "string",
                        "enum": ["进行中", "已完成", "待启动", "有卡点"],
                        "default": "待启动",
                    },
                    "manager": {"type": "string", "description": "负责人"},
                    "goal": {"type": "string", "description": "任务目标"},
                    "strategy": {"type": "string", "description": "执行策略"},
                    "deadline": {"type": "string", "description": "截止日期，格式 YYYY-MM-DD"},
                },
                "required": ["name", "committee_id"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "list_committees",
            "description": "获取所有部门列表及其基本信息",
            "parameters": {"type": "object", "properties": {}, "required": []},
        },
    },
]

# ==================== 工具执行函数 ====================

def execute_tool(name: str, args: dict, db, current_user: User) -> str:
    """执行工具调用，返回结果字符串"""
    try:
        if name == "get_task_stats":
            tasks = db.query(Task).all()
            stats = {
                "总任务数": len(tasks),
                "进行中": sum(1 for t in tasks if t.status == "进行中"),
                "已完成": sum(1 for t in tasks if t.status == "已完成"),
                "待启动": sum(1 for t in tasks if t.status == "待启动"),
                "有卡点": sum(1 for t in tasks if t.status == "有卡点"),
                "已结束": sum(1 for t in tasks if t.status == "已结束"),
            }
            return json.dumps(stats, ensure_ascii=False)

        elif name == "list_tasks":
            query = db.query(Task)
            # 非管理员只能查看自己部门的任务
            if current_user.role != "admin":
                query = query.filter(Task.committee_id == current_user.committee_id)
            elif args.get("committee_id"):
                query = query.filter(Task.committee_id == args["committee_id"])
            if args.get("status"):
                query = query.filter(Task.status == args["status"])
            limit = args.get("limit", 20)
            tasks = query.limit(limit).all()
            result = [
                {
                    "id": t.id,
                    "name": t.name,
                    "committee_id": t.committee_id,
                    "status": t.status,
                    "completion_rate": t.completion_rate,
                    "manager": t.manager,
                    "deadline": t.deadline,
                }
                for t in tasks
            ]
            return json.dumps(result, ensure_ascii=False)

        elif name == "get_task":
            task = db.query(Task).filter(Task.id == args["task_id"]).first()
            if not task:
                return json.dumps({"error": f"任务 {args['task_id']} 不存在"}, ensure_ascii=False)
            return json.dumps(
                {
                    "id": task.id,
                    "name": task.name,
                    "committee_id": task.committee_id,
                    "status": task.status,
                    "completion_rate": task.completion_rate,
                    "manager": task.manager,
                    "goal": task.goal,
                    "strategy": task.strategy,
                    "milestone": task.milestone,
                    "result": task.result,
                    "breakthrough": task.breakthrough,
                    "deadline": task.deadline,
                    "created_at": str(task.created_at),
                    "updated_at": str(task.updated_at),
                },
                ensure_ascii=False,
            )

        elif name == "update_task":
            task = db.query(Task).filter(Task.id == args["task_id"]).first()
            if not task:
                return json.dumps({"error": f"任务 {args['task_id']} 不存在"}, ensure_ascii=False)
            # 权限检查：非管理员只能更新自己部门的任务
            if current_user.role != "admin" and task.committee_id != current_user.committee_id:
                return json.dumps({"error": "无权限修改其他部门的任务"}, ensure_ascii=False)

            if "status" in args:
                task.status = args["status"]
            if "completion_rate" in args:
                task.completion_rate = args["completion_rate"]
            if "manager" in args:
                task.manager = args["manager"]
            if "result" in args:
                task.result = args["result"]
            if "breakthrough" in args:
                task.breakthrough = args["breakthrough"]
            db.commit()
            return json.dumps({"success": True, "message": f"任务 {task.name} 已更新"}, ensure_ascii=False)

        elif name == "create_task":
            # 权限检查
            if current_user.role != "admin" and args.get("committee_id") != current_user.committee_id:
                return json.dumps({"error": "无权限在其他部门创建任务"}, ensure_ascii=False)

            task_id = f"{args['committee_id']}-{str(uuid.uuid4())[:8]}"
            task = Task(
                id=task_id,
                name=args["name"],
                committee_id=args["committee_id"],
                status=args.get("status", "待启动"),
                manager=args.get("manager", ""),
                goal=args.get("goal", ""),
                strategy=args.get("strategy", ""),
                deadline=args.get("deadline", ""),
                completion_rate=0,
                created_by=current_user.id,
            )
            db.add(task)
            db.commit()
            db.refresh(task)
            return json.dumps(
                {"success": True, "message": f"任务 {task.name} 已创建", "task_id": task.id},
                ensure_ascii=False,
            )

        elif name == "list_committees":
            committees_data = [
                {"id": "qianwei", "name": "前线委员会"},
                {"id": "huojunjun", "name": "火箭军"},
                {"id": "yanwei", "name": "研发委员会"},
                {"id": "zhengjiju", "name": "政治局"},
                {"id": "shendunjv", "name": "神盾局"},
                {"id": "ziguanwei", "name": "资产管理委员会"},
                {"id": "jianwei", "name": "检察委员会"},
                {"id": "haiwei", "name": "海外委员会"},
                {"id": "zuzhihu", "name": "组织部"},
                {"id": "caiwubu", "name": "财务部"},
                {"id": "dangzuzhi", "name": "党组织"},
                {"id": "canmoubu", "name": "参谋部"},
                {"id": "zhengzhibu", "name": "政治部"},
            ]
            return json.dumps(committees_data, ensure_ascii=False)

        else:
            return json.dumps({"error": f"未知工具: {name}"}, ensure_ascii=False)

    except Exception as e:
        return json.dumps({"error": str(e)}, ensure_ascii=False)


# ==================== 系统提示词 ====================

SYSTEM_PROMPT = """你是 TTP2026 战略看板的 AI 助手，代号「突围助手」。

你可以帮助用户：
1. 查询任务统计、列表、详情
2. 更新任务状态、完成率、负责人
3. 创建新任务
4. 查询部门信息

**重要规则：**
- 回答简洁、专业，使用中文
- 执行写操作（更新/创建）前，先确认关键信息
- 数字用粗体标注，如 **15个** 任务
- 列表用简洁的格式展示
- 遇到权限问题，礼貌说明

**部门ID对照：**
- qianwei = 前线委员会
- huojunjun = 火箭军
- yanwei = 研发委员会
- zhengjiju = 政治局
- shendunjv = 神盾局
- ziguanwei = 资产管理委员会
- jianwei = 检察委员会
- haiwei = 海外委员会
- zuzhihu = 组织部
- caiwubu = 财务部
- dangzuzhi = 党组织
- canmoubu = 参谋部
- zhengzhibu = 政治部
"""

# ==================== 请求模型 ====================

class ChatRequest(BaseModel):
    messages: list[dict] | None = None
    message: str | None = None  # 简化格式：单条消息
    stream: bool = True


# ==================== 流式 Agent 对话 ====================

async def agent_stream(
    messages: list[dict],
    current_user: User,
    db,
) -> AsyncGenerator[str, None]:
    """流式 Agent 对话，支持工具调用"""
    client = get_openai_client()
    model = os.environ.get("OPENAI_MODEL", "gpt-4.1-mini")

    full_messages = [{"role": "system", "content": SYSTEM_PROMPT}] + messages

    for _ in range(6):  # 最多 6 轮工具调用
        try:
            response = await client.chat.completions.create(
                model=model,
                messages=full_messages,
                tools=TOOLS,
                tool_choice="auto",
                stream=True,
                temperature=0.3,
                max_tokens=2000,
            )
        except Exception as e:
            yield f"data: {json.dumps({'type': 'text', 'content': f'❌ AI 服务错误：{str(e)}'})}\n\n"
            yield f"data: {json.dumps({'type': 'done'})}\n\n"
            return

        assistant_content = ""
        tool_calls_buffer: dict[int, dict] = {}
        finish_reason = None

        async for chunk in response:
            choice = chunk.choices[0] if chunk.choices else None
            if not choice:
                continue

            delta = choice.delta
            finish_reason = choice.finish_reason

            if delta.content:
                assistant_content += delta.content
                yield f"data: {json.dumps({'type': 'text', 'content': delta.content})}\n\n"

            if delta.tool_calls:
                for tc in delta.tool_calls:
                    idx = tc.index
                    if idx not in tool_calls_buffer:
                        tool_calls_buffer[idx] = {"id": "", "name": "", "arguments": ""}
                    if tc.id:
                        tool_calls_buffer[idx]["id"] = tc.id
                    if tc.function:
                        if tc.function.name:
                            tool_calls_buffer[idx]["name"] += tc.function.name
                        if tc.function.arguments:
                            tool_calls_buffer[idx]["arguments"] += tc.function.arguments

        if finish_reason == "tool_calls" and tool_calls_buffer:
            tool_calls_list = [
                {
                    "id": tool_calls_buffer[i]["id"],
                    "type": "function",
                    "function": {
                        "name": tool_calls_buffer[i]["name"],
                        "arguments": tool_calls_buffer[i]["arguments"],
                    },
                }
                for i in sorted(tool_calls_buffer.keys())
            ]

            full_messages.append({
                "role": "assistant",
                "content": assistant_content or None,
                "tool_calls": tool_calls_list,
            })

            for tc in tool_calls_list:
                name = tc["function"]["name"]
                try:
                    args = json.loads(tc["function"]["arguments"] or "{}")
                except json.JSONDecodeError:
                    args = {}

                yield f"data: {json.dumps({'type': 'tool_call', 'name': name, 'args': args})}\n\n"

                result = execute_tool(name, args, db, current_user)

                full_messages.append({
                    "role": "tool",
                    "tool_call_id": tc["id"],
                    "content": result,
                })

            continue

        break

    yield f"data: {json.dumps({'type': 'done'})}\n\n"


# ==================== API 端点 ====================

@router.post("/chat")
async def agent_chat(
    request: ChatRequest,
    current_user: User = Depends(require_auth),
):
    """AI Agent 对话接口（流式 SSE）"""
    db = SessionLocal()
    try:
        # 支持两种格式：messages 数组 或 单条 message
        if request.messages:
            msgs = request.messages
        elif request.message:
            msgs = [{"role": "user", "content": request.message}]
        else:
            raise HTTPException(status_code=400, detail="请提供 message 或 messages 字段")

        return StreamingResponse(
            agent_stream(msgs, current_user, db),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "X-Accel-Buffering": "no",
            },
        )
    except Exception as e:
        db.close()
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/suggestions")
async def get_suggestions(current_user: User = Depends(require_auth)):
    """获取快捷指令建议"""
    if current_user.role == "admin":
        suggestions = [
            "查看当前各部门任务统计",
            "列出所有有卡点的任务",
            "本周完成了哪些任务？",
            "哪个部门进行中的任务最多？",
            "帮我创建一个新任务",
        ]
    else:
        suggestions = [
            "查看我们部门的任务列表",
            "有哪些任务有卡点？",
            "帮我更新任务完成率",
            "查看任务详情",
        ]
    return {"suggestions": suggestions}
