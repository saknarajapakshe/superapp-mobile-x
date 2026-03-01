-- migrations/001_initial.sql

CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(255) PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    role ENUM('user', 'admin') NOT NULL DEFAULT 'user',
    sick_allowance INT NOT NULL DEFAULT 0,
    annual_allowance INT NOT NULL DEFAULT 0,
    casual_allowance INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS leaves (
    id VARCHAR(255) PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL,
    type ENUM('sick', 'annual', 'casual') NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    reason TEXT,
    status ENUM('pending', 'approved', 'rejected') NOT NULL DEFAULT 'pending',
    approver_comment TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- create real admin user if not exists
INSERT IGNORE INTO users (id, email, role, sick_allowance, annual_allowance, casual_allowance)
VALUES (0, 'admin@example.com', 'admin', 10, 15, 5);
