"""
效益核算路由 - 提效/降本/增收记录
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Optional, Dict

from models.database import get_db, Outcome, User
from schemas.schemas import OutcomeCreate, OutcomeUpdate, OutcomeOut, OutcomeSummary
from routers.auth import get_current_user, require_auth

router = APIRouter(prefix="/api/outcomes", tags=["效益核算"])

HOURLY_RATE = 300.0   # 元/小时（提效计算用）
WORK_DAYS = 250.0     # 年工作天数
INPUT_COST_PER_DAY = 800.0  # 投入成本元/人天


def calc_annual_value(outcome: Outcome) -> float:
    """计算年化价值（万元）"""
    diff = outcome.before_value - outcome.after_value
    if outcome.type == "提效":
        # 节省小时 × 频次/月 × 12月 × 300元/小时 ÷ 10000
        return diff * (outcome.frequency or 1) * 12 * HOURLY_RATE / 10000
    elif outcome.type == "降本":
        # 节省金额/月 × 12月 ÷ 10000
        return diff * 12 / 10000
    elif outcome.type == "增收":
        # 增收金额/年（直接填万元）
        return (outcome.after_value - outcome.before_value) * (outcome.frequency or 1)
    return 0.0


@router.get("/task/{task_id}", response_model=List[OutcomeOut])
def list_by_task(task_id: str, db: Session = Depends(get_db)):
    """获取任务的效益记录"""
    return db.query(Outcome).filter(Outcome.task_id == task_id).order_by(Outcome.created_at.desc()).all()


@router.get("/committee/{committee_id}", response_model=List[OutcomeOut])
def list_by_committee(committee_id: str, db: Session = Depends(get_db)):
    """获取部门的效益记录"""
    return db.query(Outcome).filter(Outcome.committee_id == committee_id).order_by(Outcome.created_at.desc()).all()


@router.get("/summary/global")
def global_summary(db: Session = Depends(get_db)):
    """全局效益汇总（各部门）"""
    outcomes = db.query(Outcome).all()
    result: Dict[str, dict] = {}
    for o in outcomes:
        cid = o.committee_id
        if cid not in result:
            result[cid] = {"提效": 0.0, "降本": 0.0, "增收": 0.0, "count": 0, "annual_value": 0.0}
        annual = calc_annual_value(o)
        diff = o.before_value - o.after_value
        if o.type == "提效":
            result[cid]["提效"] += diff * (o.frequency or 1) * 12  # 年化节省小时
        elif o.type == "降本":
            result[cid]["降本"] += diff * 12  # 年化节省金额（元）
        elif o.type == "增收":
            result[cid]["增收"] += (o.after_value - o.before_value) * (o.frequency or 1)  # 万元/年
        result[cid]["annual_value"] += annual
        result[cid]["count"] += 1
    return result


@router.get("/summary/committee/{committee_id}", response_model=OutcomeSummary)
def committee_summary(committee_id: str, db: Session = Depends(get_db)):
    """部门效益汇总"""
    outcomes = db.query(Outcome).filter(Outcome.committee_id == committee_id).all()
    total_annual = 0.0
    ti_xiao_hours = 0.0
    jiang_ben_yuan = 0.0
    zeng_shou_wan = 0.0

    for o in outcomes:
        annual = calc_annual_value(o)
        total_annual += annual
        diff = o.before_value - o.after_value
        if o.type == "提效":
            ti_xiao_hours += diff * (o.frequency or 1) * 12
        elif o.type == "降本":
            jiang_ben_yuan += diff * 12
        elif o.type == "增收":
            zeng_shou_wan += (o.after_value - o.before_value) * (o.frequency or 1)

    count = len(outcomes)
    # ROI = 年化产出 ÷ 投入成本（假设投入1人月 = 20天 × 800元/天）
    input_cost = 20 * INPUT_COST_PER_DAY / 10000  # 万元
    avg_roi = (total_annual / input_cost * 100) if input_cost > 0 and count > 0 else 0.0

    return OutcomeSummary(
        total_annual_value=round(total_annual, 2),
        avg_roi=round(avg_roi, 1),
        count=count,
        ti_xiao_hours=round(ti_xiao_hours, 1),
        jiang_ben_yuan=round(jiang_ben_yuan, 2),
        zeng_shou_wan=round(zeng_shou_wan, 2),
    )


@router.post("/", response_model=OutcomeOut)
def create_outcome(
    data: OutcomeCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_auth)
):
    """创建效益记录"""
    outcome = Outcome(
        **data.model_dump(),
        created_by=current_user.id
    )
    db.add(outcome)
    db.commit()
    db.refresh(outcome)
    return outcome


@router.patch("/{outcome_id}", response_model=OutcomeOut)
def update_outcome(
    outcome_id: int,
    data: OutcomeUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_auth)
):
    """更新效益记录"""
    outcome = db.query(Outcome).filter(Outcome.id == outcome_id).first()
    if not outcome:
        raise HTTPException(status_code=404, detail="记录不存在")
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(outcome, key, value)
    db.commit()
    db.refresh(outcome)
    return outcome


@router.delete("/{outcome_id}")
def delete_outcome(
    outcome_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_auth)
):
    """删除效益记录"""
    outcome = db.query(Outcome).filter(Outcome.id == outcome_id).first()
    if not outcome:
        raise HTTPException(status_code=404, detail="记录不存在")
    db.delete(outcome)
    db.commit()
    return {"message": "已删除"}
