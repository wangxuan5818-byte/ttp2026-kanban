#!/usr/bin/env python3
"""
TTP2026 战略看板 - 数据库初始化脚本
执行方式: python3 init_data.py
"""
import sys
import os

# 添加backend目录到路径
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from models.database import Base, engine, SessionLocal, User
from passlib.context import CryptContext

pwd_context = CryptContext(schemes=["sha256_crypt"], deprecated="auto")

def init_db():
    """创建所有表"""
    print("📦 创建数据库表...")
    Base.metadata.create_all(bind=engine)
    print("✅ 数据库表创建完成")

def init_users():
    """初始化默认用户"""
    db = SessionLocal()
    try:
        # 检查是否已有用户
        existing = db.query(User).count()
        if existing > 0:
            print(f"⚠️  数据库中已有 {existing} 个用户，跳过初始化")
            return

        accounts = [
            ("admin", "admin2026", "admin", None, "系统管理员"),
            ("canmoubu", "ttp2026@canmoubu", "member", "canmoubu", "参谋部"),
            ("zhengzhibu", "ttp2026@zhengzhibu", "member", "zhengzhibu", "政治部"),
            ("qianwei", "ttp2026@qianwei", "member", "qianwei", "前委会"),
            ("huojunjun", "ttp2026@huojunjun", "member", "huojunjun", "火箭军"),
            ("yanwei", "ttp2026@yanwei", "member", "yanwei", "研委会"),
            ("zhengjiju", "ttp2026@zhengjiju", "member", "zhengjiju", "政治局"),
            ("shendunjv", "ttp2026@shendunjv", "member", "shendunjv", "神盾局"),
            ("ziguanwei", "ttp2026@ziguanwei", "member", "ziguanwei", "资管委"),
            ("jianwei", "ttp2026@jianwei", "member", "jianwei", "检委会"),
            ("haiwei", "ttp2026@haiwei", "member", "haiwei", "海委会"),
            ("zuzhihu", "ttp2026@zuzhihu", "member", "zuzhihu", "组织部"),
            ("caiwubu", "ttp2026@caiwubu", "member", "caiwubu", "财务部"),
            ("dangzuzhi", "ttp2026@dangzuzhi", "member", "dangzuzhi", "党组织"),
        ]

        for username, password, role, committee_id, display_name in accounts:
            user = User(
                username=username,
                password_hash=pwd_context.hash(password),
                role=role,
                committee_id=committee_id,
                display_name=display_name,
                is_active=True,
            )
            db.add(user)
            print(f"  ✅ 创建用户: {username} ({display_name})")

        db.commit()
        print(f"\n✅ 共创建 {len(accounts)} 个用户")

    except Exception as e:
        db.rollback()
        print(f"❌ 初始化失败: {e}")
        raise
    finally:
        db.close()

def reset_passwords():
    """重置所有用户密码（用于修复密码哈希不兼容问题）"""
    db = SessionLocal()
    try:
        accounts = {
            "admin": "admin2026",
            "canmoubu": "ttp2026@canmoubu",
            "zhengzhibu": "ttp2026@zhengzhibu",
            "qianwei": "ttp2026@qianwei",
            "huojunjun": "ttp2026@huojunjun",
            "yanwei": "ttp2026@yanwei",
            "zhengjiju": "ttp2026@zhengjiju",
            "shendunjv": "ttp2026@shendunjv",
            "ziguanwei": "ttp2026@ziguanwei",
            "jianwei": "ttp2026@jianwei",
            "haiwei": "ttp2026@haiwei",
            "zuzhihu": "ttp2026@zuzhihu",
            "caiwubu": "ttp2026@caiwubu",
            "dangzuzhi": "ttp2026@dangzuzhi",
        }

        for username, password in accounts.items():
            user = db.query(User).filter(User.username == username).first()
            if user:
                user.password_hash = pwd_context.hash(password)
                user.is_active = True
                print(f"  ✅ 重置密码: {username}")
            else:
                print(f"  ⚠️  用户不存在: {username}")

        db.commit()
        print("✅ 密码重置完成")

    except Exception as e:
        db.rollback()
        print(f"❌ 重置失败: {e}")
        raise
    finally:
        db.close()

if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="TTP2026 数据库初始化工具")
    parser.add_argument("--reset-passwords", action="store_true", help="重置所有用户密码")
    args = parser.parse_args()

    init_db()

    if args.reset_passwords:
        reset_passwords()
    else:
        init_users()

    print("\n🎉 初始化完成！")
    print("   管理员账号: admin / admin2026")
    print("   参谋部账号: canmoubu / ttp2026@canmoubu")
    print("   政治部账号: zhengzhibu / ttp2026@zhengzhibu")
