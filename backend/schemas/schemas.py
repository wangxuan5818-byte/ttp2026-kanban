"""
Pydantic 数据验证模式
TTP2026 战略看板
"""
from pydantic import BaseModel, Field
from typing import Optional, List, Literal
from datetime import datetime


# ==================== 用户相关 ====================

class UserCreate(BaseModel):
    username: str = Field(..., min_length=2, max_length=50)
    password: str = Field(..., min_length=6)
    display_name: Optional[str] = None
    role: Literal["admin", "member", "viewer"] = "member"
    committee_id: Optional[str] = None


class UserUpdate(BaseModel):
    display_name: Optional[str] = None
    role: Optional[Literal["admin", "member", "viewer"]] = None
    committee_id: Optional[str] = None
    is_active: Optional[bool] = None


class UserOut(BaseModel):
    id: int
    username: str
    display_name: Optional[str]
    role: str
    committee_id: Optional[str]
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


class LoginRequest(BaseModel):
    username: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


# ==================== 任务相关 ====================

class TaskCreate(BaseModel):
    id: str = Field(..., min_length=1, max_length=50)
    committee_id: str
    name: str = Field(..., min_length=1, max_length=200)
    goal: Optional[str] = None
    strategy: Optional[str] = None
    milestone: Optional[str] = None
    result: Optional[str] = None
    breakthrough: Optional[str] = None
    manager: Optional[str] = None
    deadline: Optional[str] = None
    status: Literal["待启动", "进行中", "有卡点", "已完成", "已结束"] = "待启动"
    completion_rate: int = Field(0, ge=0, le=100)
    reward_pool: Optional[str] = None


class TaskUpdate(BaseModel):
    name: Optional[str] = None
    goal: Optional[str] = None
    strategy: Optional[str] = None
    milestone: Optional[str] = None
    result: Optional[str] = None
    breakthrough: Optional[str] = None
    manager: Optional[str] = None
    deadline: Optional[str] = None
    status: Optional[Literal["待启动", "进行中", "有卡点", "已完成", "已结束"]] = None
    completion_rate: Optional[int] = Field(None, ge=0, le=100)
    reward_pool: Optional[str] = None


class TaskOut(BaseModel):
    id: str
    committee_id: str
    name: str
    goal: Optional[str]
    strategy: Optional[str]
    milestone: Optional[str]
    result: Optional[str]
    breakthrough: Optional[str]
    manager: Optional[str]
    deadline: Optional[str]
    status: str
    completion_rate: int
    reward_pool: Optional[str]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# ==================== 效益核算相关 ====================

class OutcomeCreate(BaseModel):
    task_id: str
    committee_id: str
    type: Literal["提效", "降本", "增收"]
    scenario: str = Field(..., min_length=1, max_length=200)
    before_value: float
    after_value: float
    unit: str = "小时/次"
    frequency: float = 1.0
    remark: Optional[str] = None


class OutcomeUpdate(BaseModel):
    scenario: Optional[str] = None
    before_value: Optional[float] = None
    after_value: Optional[float] = None
    unit: Optional[str] = None
    frequency: Optional[float] = None
    remark: Optional[str] = None


class OutcomeOut(BaseModel):
    id: int
    task_id: str
    committee_id: str
    type: str
    scenario: str
    before_value: float
    after_value: float
    unit: str
    frequency: float
    remark: Optional[str]
    created_by: Optional[int]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class OutcomeSummary(BaseModel):
    """效益汇总"""
    total_annual_value: float  # 年化总价值（万元）
    avg_roi: float             # 平均ROI（%）
    count: int                 # 记录数
    ti_xiao_hours: float       # 提效总小时
    jiang_ben_yuan: float      # 降本总金额（元/年）
    zeng_shou_wan: float       # 增收总金额（万元/年）


# ==================== 部门配置相关 ====================

class CommitteeConfigCreate(BaseModel):
    id: str
    full_name: Optional[str] = None
    short_name: Optional[str] = None
    chairman: Optional[str] = None
    director: Optional[str] = None
    annual_goal: Optional[str] = None
    reward_pool: Optional[str] = None
    committee_status: Literal["active", "paused", "terminated"] = "active"
    sort_order: int = 0
    ding_talk_webhook: Optional[str] = None


class CommitteeConfigUpdate(BaseModel):
    full_name: Optional[str] = None
    short_name: Optional[str] = None
    chairman: Optional[str] = None
    director: Optional[str] = None
    annual_goal: Optional[str] = None
    reward_pool: Optional[str] = None
    committee_status: Optional[Literal["active", "paused", "terminated"]] = None
    sort_order: Optional[int] = None
    ding_talk_webhook: Optional[str] = None


class CommitteeConfigOut(BaseModel):
    id: str
    full_name: Optional[str]
    short_name: Optional[str]
    chairman: Optional[str]
    director: Optional[str]
    annual_goal: Optional[str]
    reward_pool: Optional[str]
    committee_status: str
    sort_order: int
    ding_talk_webhook: Optional[str]
    updated_at: datetime

    class Config:
        from_attributes = True


# ==================== 积分相关 ====================

class ScoreCreate(BaseModel):
    user_id: int
    committee_id: str
    task_id: Optional[str] = None
    score_type: str
    points: int
    reason: Optional[str] = None


class ScoreOut(BaseModel):
    id: int
    user_id: int
    committee_id: str
    task_id: Optional[str]
    score_type: str
    points: int
    reason: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


# ==================== 系统配置相关 ====================

class SystemConfigUpdate(BaseModel):
    config_value: str


class SystemConfigOut(BaseModel):
    config_key: str
    config_value: Optional[str]
    description: Optional[str]
    updated_at: datetime

    class Config:
        from_attributes = True
