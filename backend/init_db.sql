-- TTP2026 战略看板数据库初始化脚本
-- 执行方式: mysql -u root -p < init_db.sql

-- 创建数据库
CREATE DATABASE IF NOT EXISTS ttp2026_kanban
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

-- 创建专用用户
CREATE USER IF NOT EXISTS 'kanban'@'localhost' IDENTIFIED BY 'kanban2026';
CREATE USER IF NOT EXISTS 'kanban'@'%' IDENTIFIED BY 'kanban2026';

-- 授权
GRANT ALL PRIVILEGES ON ttp2026_kanban.* TO 'kanban'@'localhost';
GRANT ALL PRIVILEGES ON ttp2026_kanban.* TO 'kanban'@'%';

FLUSH PRIVILEGES;

SELECT '✅ 数据库初始化完成' AS message;
