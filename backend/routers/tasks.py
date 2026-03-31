"""
任务路由 - CRUD操作
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime, timedelta

from models.database import get_db, Task, User
from schemas.schemas import TaskCreate, TaskUpdate, TaskOut
from routers.auth import get_current_user, require_auth

router = APIRouter(prefix="/api/tasks", tags=["任务"])


@router.get("/", response_model=List[TaskOut])
def list_tasks(
    committee_id: Optional[str] = None,
    status: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user)
):
    """获取任务列表"""
    query = db.query(Task)
    if committee_id:
        query = query.filter(Task.committee_id == committee_id)
    if status:
        query = query.filter(Task.status == status)
    return query.order_by(Task.created_at.desc()).all()


@router.get("/stats")
def get_task_stats(db: Session = Depends(get_db)):
    """获取任务统计数据"""
    all_tasks = db.query(Task).all()
    total = len(all_tasks)
    in_progress = sum(1 for t in all_tasks if t.status == "进行中")
    blocked = sum(1 for t in all_tasks if t.status == "有卡点")
    done = sum(1 for t in all_tasks if t.status in ("已完成", "已结束"))
    pending = sum(1 for t in all_tasks if t.status == "待启动")

    # 本周新增
    week_ago = datetime.utcnow() - timedelta(days=7)
    new_this_week = sum(1 for t in all_tasks if t.created_at and t.created_at >= week_ago)
    done_this_week = sum(1 for t in all_tasks
                         if t.updated_at and t.updated_at >= week_ago
                         and t.status in ("已完成", "已结束"))

    return {
        "total": total,
        "inProgress": in_progress,
        "blocked": blocked,
        "done": done,
        "pending": pending,
        "newThisWeek": new_this_week,
        "doneThisWeek": done_this_week,
    }


@router.get("/weekly-trend")
def get_weekly_trend(db: Session = Depends(get_db)):
    """获取近4周完成趋势"""
    result = []
    for i in range(3, -1, -1):
        week_start = datetime.utcnow() - timedelta(days=(i + 1) * 7)
        week_end = datetime.utcnow() - timedelta(days=i * 7)
        done = db.query(Task).filter(
            Task.updated_at >= week_start,
            Task.updated_at < week_end,
            Task.status.in_(["已完成", "已结束"])
        ).count()
        label = f"W-{i}" if i > 0 else "本周"
        result.append({"label": label, "done": done})
    return result


@router.get("/committee-weekly-stats")
def get_committee_weekly_stats(db: Session = Depends(get_db)):
    """获取各部门本周统计"""
    week_ago = datetime.utcnow() - timedelta(days=7)
    tasks = db.query(Task).all()
    stats = {}
    for task in tasks:
        cid = task.committee_id
        if cid not in stats:
            stats[cid] = {"newCount": 0, "doneCount": 0}
        if task.created_at and task.created_at >= week_ago:
            stats[cid]["newCount"] += 1
        if task.updated_at and task.updated_at >= week_ago and task.status in ("已完成", "已结束"):
            stats[cid]["doneCount"] += 1
    return stats


@router.get("/{task_id}", response_model=TaskOut)
def get_task(task_id: str, db: Session = Depends(get_db)):
    """获取单个任务"""
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="任务不存在")
    return task


@router.post("/", response_model=TaskOut)
def create_task(
    task_data: TaskCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_auth)
):
    """创建任务"""
    existing = db.query(Task).filter(Task.id == task_data.id).first()
    if existing:
        raise HTTPException(status_code=400, detail="任务ID已存在")
    task = Task(
        **task_data.model_dump(),
        created_by=current_user.id
    )
    db.add(task)
    db.commit()
    db.refresh(task)
    return task


@router.patch("/{task_id}", response_model=TaskOut)
def update_task(
    task_id: str,
    task_data: TaskUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_auth)
):
    """更新任务"""
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="任务不存在")

    update_data = task_data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(task, key, value)

    db.commit()
    db.refresh(task)
    return task


@router.delete("/{task_id}")
def delete_task(
    task_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_auth)
):
    """删除任务"""
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="任务不存在")
    db.delete(task)
    db.commit()
    return {"message": "任务已删除"}
