FROM python:3.11-slim

WORKDIR /app

# 安装依赖
COPY backend/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# 复制后端代码（已包含 static/ 前端文件）
COPY backend/ ./backend/

# 创建数据目录（SQLite持久化）
RUN mkdir -p /app/backend/data

# 设置环境变量
ENV SQLITE_PATH=/app/backend/data/ttp2026.db
ENV PYTHONPATH=/app/backend

# 暴露端口
EXPOSE 8000

# 启动命令
WORKDIR /app/backend
CMD ["python", "-m", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
