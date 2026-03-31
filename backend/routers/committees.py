"""
部门配置路由
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional

from models.database import get_db, CommitteeConfig, User, SystemConfig
from schemas.schemas import CommitteeConfigCreate, CommitteeConfigUpdate, CommitteeConfigOut, SystemConfigUpdate, SystemConfigOut
from routers.auth import get_current_user, require_auth, require_admin

router = APIRouter(prefix="/api/committees", tags=["部门配置"])


@router.get("/configs", response_model=List[CommitteeConfigOut])
def list_configs(db: Session = Depends(get_db)):
    """获取所有部门配置"""
    return db.query(CommitteeConfig).order_by(CommitteeConfig.sort_order).all()


@router.get("/configs/{committee_id}", response_model=CommitteeConfigOut)
def get_config(committee_id: str, db: Session = Depends(get_db)):
    """获取单个部门配置"""
    config = db.query(CommitteeConfig).filter(CommitteeConfig.id == committee_id).first()
    if not config:
        raise HTTPException(status_code=404, detail="部门配置不存在")
    return config


@router.post("/configs", response_model=CommitteeConfigOut)
def create_config(
    data: CommitteeConfigCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """创建/覆盖部门配置"""
    existing = db.query(CommitteeConfig).filter(CommitteeConfig.id == data.id).first()
    if existing:
        for key, value in data.model_dump(exclude_unset=True).items():
            setattr(existing, key, value)
        db.commit()
        db.refresh(existing)
        return existing
    config = CommitteeConfig(**data.model_dump())
    db.add(config)
    db.commit()
    db.refresh(config)
    return config


@router.patch("/configs/{committee_id}", response_model=CommitteeConfigOut)
def update_config(
    committee_id: str,
    data: CommitteeConfigUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """更新部门配置"""
    config = db.query(CommitteeConfig).filter(CommitteeConfig.id == committee_id).first()
    if not config:
        raise HTTPException(status_code=404, detail="部门配置不存在")
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(config, key, value)
    db.commit()
    db.refresh(config)
    return config


@router.delete("/configs/{committee_id}")
def delete_config(
    committee_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """删除部门配置（恢复为静态默认值）"""
    config = db.query(CommitteeConfig).filter(CommitteeConfig.id == committee_id).first()
    if not config:
        raise HTTPException(status_code=404, detail="部门配置不存在")
    db.delete(config)
    db.commit()
    return {"message": "已删除，将使用默认配置"}


# ==================== 系统配置 ====================

@router.get("/system-configs", response_model=List[SystemConfigOut])
def list_system_configs(db: Session = Depends(get_db)):
    """获取系统配置"""
    return db.query(SystemConfig).all()


@router.patch("/system-configs/{config_key}", response_model=SystemConfigOut)
def update_system_config(
    config_key: str,
    data: SystemConfigUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """更新系统配置"""
    config = db.query(SystemConfig).filter(SystemConfig.config_key == config_key).first()
    if not config:
        config = SystemConfig(config_key=config_key, config_value=data.config_value)
        db.add(config)
    else:
        config.config_value = data.config_value
    db.commit()
    db.refresh(config)
    return config
