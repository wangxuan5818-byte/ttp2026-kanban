"""
数据库连接与模型定义
TTP2026 战略看板 - Python + MySQL 后端
"""
from sqlalchemy import create_engine, Column, Integer, String, Text, Float, DateTime, Boolean, ForeignKey, Enum
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship
from sqlalchemy.sql import func
import os
from dotenv import load_dotenv

load_dotenv()

# 数据库连接配置
# 支持 MySQL 和 SQLite：若未设置 DATABASE_URL 则自动使用 SQLite
_raw_db_url = os.getenv("DATABASE_URL", "")
if _raw_db_url and ("mysql" in _raw_db_url or "postgres" in _raw_db_url):
    DATABASE_URL = _raw_db_url
    engine = create_engine(
        DATABASE_URL,
        pool_pre_ping=True,
        pool_recycle=3600,
        echo=False
    )
else:
    # SQLite 模式（云部署 / 本地开发备用）
    _sqlite_path = os.getenv("SQLITE_PATH", os.path.join(os.path.dirname(__file__), "..", "data", "ttp2026.db"))
    os.makedirs(os.path.dirname(os.path.abspath(_sqlite_path)), exist_ok=True)
    DATABASE_URL = f"sqlite:///{os.path.abspath(_sqlite_path)}"
    engine = create_engine(
        DATABASE_URL,
        connect_args={"check_same_thread": False},
        echo=False
    )

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    """获取数据库会话"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# ==================== 数据模型 ====================

class User(Base):
    """用户表"""
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    display_name = Column(String(100))
    role = Column(Enum("admin", "member", "viewer", name="user_role"), default="member")
    committee_id = Column(String(50), nullable=True)  # 所属部门ID
    is_active = Column(Boolean, default=True, server_default="1", nullable=False)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    # 关联
    tasks = relationship("Task", back_populates="creator", foreign_keys="Task.created_by")
    outcomes = relationship("Outcome", back_populates="creator")
    scores = relationship("Score", back_populates="user")


class CommitteeConfig(Base):
    """部门配置表（覆盖静态数据）"""
    __tablename__ = "committee_configs"

    id = Column(String(50), primary_key=True)  # 与静态数据的id对应
    full_name = Column(String(100))
    short_name = Column(String(50))
    chairman = Column(String(50))
    director = Column(String(50))
    annual_goal = Column(Text)
    reward_pool = Column(Text)
    committee_status = Column(
        Enum("active", "paused", "terminated", name="committee_status"),
        default="active"
    )
    sort_order = Column(Integer, default=0)
    ding_talk_webhook = Column(String(500))
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())


class Task(Base):
    """任务表"""
    __tablename__ = "tasks"

    id = Column(String(50), primary_key=True)
    committee_id = Column(String(50), nullable=False, index=True)
    name = Column(String(200), nullable=False)
    goal = Column(Text)
    strategy = Column(Text)
    milestone = Column(Text)
    result = Column(Text)
    breakthrough = Column(Text)
    manager = Column(String(50))
    deadline = Column(String(20))
    status = Column(
        Enum("待启动", "进行中", "有卡点", "已完成", "已结束", name="task_status"),
        default="待启动"
    )
    completion_rate = Column(Integer, default=0)
    reward_pool = Column(String(200))
    created_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    # 关联
    creator = relationship("User", back_populates="tasks", foreign_keys=[created_by])
    outcomes = relationship("Outcome", back_populates="task", cascade="all, delete-orphan")


class Outcome(Base):
    """效益核算记录表"""
    __tablename__ = "outcomes"

    id = Column(Integer, primary_key=True, autoincrement=True)
    task_id = Column(String(50), ForeignKey("tasks.id"), nullable=False, index=True)
    committee_id = Column(String(50), nullable=False, index=True)
    type = Column(Enum("提效", "降本", "增收", name="outcome_type"), nullable=False)
    scenario = Column(String(200), nullable=False)
    before_value = Column(Float, nullable=False)
    after_value = Column(Float, nullable=False)
    unit = Column(String(50), default="小时/次")
    frequency = Column(Float, default=1.0)
    remark = Column(Text)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    # 关联
    task = relationship("Task", back_populates="outcomes")
    creator = relationship("User", back_populates="outcomes")


class Score(Base):
    """积分记录表"""
    __tablename__ = "scores"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    committee_id = Column(String(50), nullable=False)
    task_id = Column(String(50), nullable=True)
    score_type = Column(String(50), nullable=False)  # 积分类型
    points = Column(Integer, nullable=False, default=0)
    reason = Column(Text)
    created_at = Column(DateTime, server_default=func.now())

    # 关联
    user = relationship("User", back_populates="scores")


class SystemConfig(Base):
    """系统配置表"""
    __tablename__ = "system_configs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    config_key = Column(String(100), unique=True, nullable=False)
    config_value = Column(Text)
    description = Column(String(200))
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())


def create_tables():
    """创建所有表"""
    Base.metadata.create_all(bind=engine)
    print("✅ 数据库表创建完成")
