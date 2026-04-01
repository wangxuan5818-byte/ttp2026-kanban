"""
TTP2026 战略看板 - Python FastAPI 后端
数据库：MySQL（通过SQLAlchemy连接）
"""
import os
import sys
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from contextlib import asynccontextmanager
from passlib.context import CryptContext

# 添加当前目录到路径
sys.path.insert(0, os.path.dirname(__file__))

from models.database import create_tables, SessionLocal, User, SystemConfig
from routers import auth, tasks, outcomes, committees, users, trpc_compat, agent

pwd_context = CryptContext(schemes=["sha256_crypt"], deprecated="auto")


def init_default_data():
    """初始化默认数据"""
    db = SessionLocal()
    try:
        # 创建默认管理员账号
        admin = db.query(User).filter(User.username == "admin").first()
        if not admin:
            admin = User(
                username="admin",
                password_hash=pwd_context.hash("admin2026"),
                display_name="系统管理员",
                role="admin",
                committee_id=None,
            )
            db.add(admin)
            print("✅ 创建默认管理员账号: admin / admin2026")

        # 创建各部门默认账号
        default_users = [
            ("qianwei", "ttp2026@qianwei", "前线委员会", "member", "qianwei"),
            ("huojunjun", "ttp2026@huojunjun", "火箭军", "member", "huojunjun"),
            ("yanwei", "ttp2026@yanwei", "研发委员会", "member", "yanwei"),
            ("zhengjiju", "ttp2026@zhengjiju", "政治局", "member", "zhengjiju"),
            ("shendunjv", "ttp2026@shendunjv", "神盾局", "member", "shendunjv"),
            ("ziguanwei", "ttp2026@ziguanwei", "资产管理委员会", "member", "ziguanwei"),
            ("jianwei", "ttp2026@jianwei", "检察委员会", "member", "jianwei"),
            ("haiwei", "ttp2026@haiwei", "海外委员会", "member", "haiwei"),
            ("zuzhihu", "ttp2026@zuzhihu", "组织部", "member", "zuzhihu"),
            ("caiwubu", "ttp2026@caiwubu", "财务部", "member", "caiwubu"),
            ("dangzuzhi", "ttp2026@dangzuzhi", "党组织", "member", "dangzuzhi"),
            ("canmoubu", "ttp2026@canmoubu", "参谋部", "member", "canmoubu"),
            ("zhengzhibu", "ttp2026@zhengzhibu", "政治部", "member", "zhengzhibu"),
        ]

        for username, password, display_name, role, committee_id in default_users:
            existing = db.query(User).filter(User.username == username).first()
            if not existing:
                user = User(
                    username=username,
                    password_hash=pwd_context.hash(password),
                    display_name=display_name,
                    role=role,
                    committee_id=committee_id,
                )
                db.add(user)

        # 初始化系统配置
        default_configs = [
            ("strategic_goal", "AI战略转型", "年度战略目标"),
            ("total_target", "600万", "年度总目标金额"),
            ("deadline", "2026-12-31", "截止日期"),
        ]
        for key, value, desc in default_configs:
            existing = db.query(SystemConfig).filter(SystemConfig.config_key == key).first()
            if not existing:
                db.add(SystemConfig(config_key=key, config_value=value, description=desc))

        db.commit()
        print("✅ 默认数据初始化完成")
    except Exception as e:
        print(f"⚠️  初始化数据时出错: {e}")
        db.rollback()
    finally:
        db.close()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """应用生命周期"""
    print("🚀 TTP2026 战略看板后端启动中...")
    create_tables()
    init_default_data()
    print("✅ 后端服务就绪，监听端口 8000")
    yield
    print("👋 后端服务关闭")


# 创建FastAPI应用
app = FastAPI(
    title="TTP2026 战略看板 API",
    description="三体人突围战 · AI战略指挥中心 · Python + MySQL 后端",
    version="2.0.0",
    lifespan=lifespan,
)

# CORS配置（允许前端访问）
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 生产环境应限制为具体域名
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 注册路由
app.include_router(auth.router)
app.include_router(tasks.router)
app.include_router(outcomes.router)
app.include_router(committees.router)
app.include_router(users.router)
app.include_router(trpc_compat.router)
app.include_router(agent.router)


@app.get("/api/health")
def health_check():
    """健康检查"""
    return {
        "status": "ok",
        "service": "TTP2026 战略看板",
        "version": "2.0.0",
        "backend": "Python FastAPI + MySQL"
    }


# 静态文件服务（前端构建产物）
# 优先使用 dist/public（pnpm build 输出），其次是 client/dist
for _dist_candidate in [
    os.path.join(os.path.dirname(__file__), "..", "dist", "public"),
    os.path.join(os.path.dirname(__file__), "static"),
    os.path.join(os.path.dirname(__file__), "..", "client", "dist"),
]:
    if os.path.exists(os.path.join(_dist_candidate, "index.html")):
        frontend_dist = _dist_candidate
        break
else:
    frontend_dist = None

if frontend_dist and os.path.exists(frontend_dist):
    _assets_dir = os.path.join(frontend_dist, "assets")
    if os.path.exists(_assets_dir):
        app.mount("/assets", StaticFiles(directory=_assets_dir), name="assets")
    _manus_dir = os.path.join(frontend_dist, "__manus__")
    if os.path.exists(_manus_dir):
        app.mount("/__manus__", StaticFiles(directory=_manus_dir), name="manus_assets")

    @app.get("/{full_path:path}")
    def serve_frontend(full_path: str):
        """前端路由回退"""
        index_file = os.path.join(frontend_dist, "index.html")
        if os.path.exists(index_file):
            return FileResponse(index_file)
        return {"message": "前端文件未找到，请先构建前端"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        reload_dirs=[os.path.dirname(__file__)],
    )
