"""
用户管理路由
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from models.database import get_db, User, Score
from schemas.schemas import UserOut, UserUpdate, ScoreCreate, ScoreOut
from routers.auth import require_auth, require_admin, get_password_hash

router = APIRouter(prefix="/api/users", tags=["用户管理"])


@router.get("/", response_model=List[UserOut])
def list_users(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """获取所有用户（管理员）"""
    return db.query(User).order_by(User.created_at.desc()).all()


@router.get("/{user_id}", response_model=UserOut)
def get_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_auth)
):
    """获取用户信息"""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="用户不存在")
    return user


@router.patch("/{user_id}", response_model=UserOut)
def update_user(
    user_id: int,
    data: UserUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """更新用户信息（管理员）"""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="用户不存在")
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(user, key, value)
    db.commit()
    db.refresh(user)
    return user


@router.post("/{user_id}/reset-password")
def reset_password(
    user_id: int,
    new_password: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """重置密码（管理员）"""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="用户不存在")
    user.password_hash = get_password_hash(new_password)
    db.commit()
    return {"message": "密码已重置"}


@router.delete("/{user_id}")
def delete_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """删除用户（管理员）"""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="用户不存在")
    if user.id == current_user.id:
        raise HTTPException(status_code=400, detail="不能删除自己")
    db.delete(user)
    db.commit()
    return {"message": "用户已删除"}


# ==================== 积分 ====================

@router.get("/{user_id}/scores", response_model=List[ScoreOut])
def get_user_scores(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_auth)
):
    """获取用户积分记录"""
    return db.query(Score).filter(Score.user_id == user_id).order_by(Score.created_at.desc()).all()


@router.get("/scores/leaderboard")
def get_leaderboard(db: Session = Depends(get_db)):
    """积分排行榜"""
    users = db.query(User).filter(User.is_active == True).all()
    result = []
    for user in users:
        total = sum(s.points for s in user.scores)
        result.append({
            "userId": user.id,
            "username": user.username,
            "displayName": user.display_name,
            "committeeId": user.committee_id,
            "totalPoints": total,
        })
    result.sort(key=lambda x: x["totalPoints"], reverse=True)
    return result


@router.post("/scores", response_model=ScoreOut)
def add_score(
    data: ScoreCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """添加积分记录（管理员）"""
    user = db.query(User).filter(User.id == data.user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="用户不存在")
    score = Score(**data.model_dump())
    db.add(score)
    db.commit()
    db.refresh(score)
    return score
