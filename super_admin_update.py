from pathlib import Path

html = '''<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>SmartSchool | Super Admin Terminal</title>
    <link rel="stylesheet" href="assets/style.css">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
    <style>
        :root {
            --primary: #2563eb;
            --primary-strong: #1d4ed8;
            --primary-soft: rgba(37, 99, 235, 0.12);
            --bg-body: #edf4ff;
            --sidebar: #0f172a;
            --card-bg: rgba(255, 255, 255, 0.96);
            --text-main: #0f172a;
            --text-muted: #475569;
            --line: rgba(148, 163, 184, 0.22);
            --success: #22c55e;
            --danger: #ef4444;
            --shadow: 0 22px 55px rgba(15, 23, 42, 0.12);
        }

        :root[data-theme='dark'] {
            --bg-body: #0f172a;
            --sidebar: #020817;
            --card-bg: rgba(15, 23, 42, 0.93);
            --text-main: #e2e8f0;
            --text-muted: #94a3b8;
            --line: rgba(148, 163, 184, 0.18);
        }

        * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
            font-family: 'Inter', 'Segoe UI', sans-serif;
        }

        body {
            display: flex;
            min-height: 100vh;
            background:
                radial-gradient(circle at top left, rgba(37, 99, 235, 0.12), transparent 25%),
                radial-gradient(circle at bottom right, rgba(14, 165, 233, 0.12), transparent 28%),
                linear-gradient(135deg, #f1f7ff 0%, var(--bg-body) 100%);
            color: var(--text-main);
        }

        nav {
            position: fixed;
            inset: 0 auto 0 0;
            width: 230px;
            background: rgba(15, 23, 42, 0.98);
            color: #fff;
            display: flex;
            flex-direction: column;
            padding: 18px 14px 16px;
            box-shadow: 20px 0 32px rgba(15, 23, 42, 0.12);
            z-index: 10;
        }

        .nav-brand {
            display: flex;
            align-items: center;
            gap: 12px;
            padding: 10px 10px 18px;
            margin-bottom: 10px;
            border-bottom: 1px solid rgba(148, 163, 184, 0.12);
        }

        .brand-mark {
            width: 34px;
            height: 34px;
            border-radius: 10px;
            display: flex;
            align-items: center;
            justify-content: center;
            background: linear-gradient(135deg, var(--primary) 0%, var(--primary-strong) 100%);
            box-shadow: 0 12px 22px rgba(37, 99, 235, 0.25);
            color: #fff;
            font-size: 0.9rem;
        }

        .nav-brand h1 {
            font-size: 1.7rem;
            font-weight: 800;
            letter-spacing: -0.05em;
            color: #f8fafc;
        }

        .nav-brand h1 span {
            color: #93c5fd;
        }

        .nav-menu {
            flex: 1;
            padding-top: 10px;
        }

        .nav-menu a {
            display: flex;
            align-items: center;
            gap: 12px;
            padding: 12px 14px;
            margin: 6px 0;
            text-decoration: none;
            color: #cbd5e1;
            border-radius: 12px;
            border: 1px solid transparent;
            font-weight: 600;
            transition: all 0.2s ease;
        }

        .nav-menu a i {
            width: 18px;
            text-align: center;
            color: #93c5fd;
        }

        .nav-menu a:hover,
        .nav-menu a.active {
            background: linear-gradient(135deg, rgba(37, 99, 235, 0.9), rgba(29, 78, 216, 0.96));
            color: #fff;
            border-color: rgba(255, 255, 255, 0.14);
            box-shadow: 0 12px 22px rgba(37, 99, 235, 0.25);
        }

        .nav-menu a:hover i,
        .nav-menu a.active i {
            color: #fff;
        }

        .nav-footer {
            padding: 8px 8px 0;
            border-top: 1px solid rgba(148, 163, 184, 0.12);
        }

        .logout-btn {
            width: 100%;
            border: 1px solid rgba(239, 68, 68, 0.3);
            border-radius: 10px;
            background: rgba(239, 68, 68, 0.08);
            color: #fca5a5;
            font-weight: 700;
            padding: 11px 14px;
            cursor: pointer;
        }

        main {
            margin-left: 230px;
            width: calc(100% - 230px);
            padding: 28px 34px 40px;
        }

        .page-shell {
            max-width: 1200px;
            margin: 0 auto;
        }

        .page-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 16px;
            margin-bottom: 18px;
            flex-wrap: wrap;
        }

        .header-copy h2 {
            font-size: clamp(2rem, 2.7vw, 2.9rem);
            font-weight: 800;
            letter-spacing: -0.06em;
            margin: 0;
        }

        .header-copy p {
            margin-top: 6px;
            color: var(--text-muted);
            font-size: 0.95rem;
        }

        .header-actions {
            display: flex;
            align-items: center;
            gap: 10px;
        }

        .icon-btn,
        .admin-pill {
            background: rgba(255, 255, 255, 0.78);
            border: 1px solid var(--line);
            border-radius: 14px;
            box-shadow: 0 22px 55px rgba(15, 23, 42, 0.12);
            backdrop-filter: blur(10px);
        }

        .icon-btn {
            width: 42px;
            height: 42px;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            color: var(--text-main);
            cursor: pointer;
            position: relative;
        }

        .notification-badge {
            position: absolute;
            top: -5px;
            right: -5px;
            display: none;
            min-width: 18px;
            height: 18px;
            padding: 0 4px;
            border-radius: 50%;
            background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
            color: #fff;
            font-size: 0.62rem;
            font-weight: 800;
            align-items: center;
            justify-content: center;
        }

        .admin-pill {
            display: inline-flex;
            align-items: center;
            gap: 10px;
            padding: 10px 14px;
            color: var(--text-main);
            font-weight: 700;
        }

        .admin-pill i {
            color: var(--primary);
            font-size: 1.05rem;
        }

        .theme-btn {
            border: none;
            border-radius: 12px;
            background: linear-gradient(135deg, var(--primary) 0%, var(--primary-strong) 100%);
            color: #fff;
            padding: 11px 18px;
            font-weight: 700;
            cursor: pointer;
            box-shadow: 0 12px 22px rgba(37, 99, 235, 0.22);
        }

        .stats-row {
            display: grid;
            grid-template-columns: repeat(4, minmax(170px, 1fr));
            gap: 16px;
            margin-bottom: 24px;
        }

        .stat-card {
            display: flex;
            align-items: center;
            gap: 14px;
            background: linear-gradient(180deg, rgba(255,255,255,0.96), rgba(248,250,252,0.96));
            border: 1px solid var(--line);
            border-radius: 18px;
            padding: 18px;
            box-shadow: 0 22px 55px rgba(15, 23, 42, 0.12);
        }

        .stat-icon {
            width: 46px;
            height: 46px;
            border-radius: 14px;
            display: flex;
            align-items: center;
            justify-content: center;
            color: #fff;
            font-size: 1.1rem;
        }

        .stat-icon.blue { background: linear-gradient(135deg, #2563eb 0%, #60a5fa 100%); }
        .stat-icon.purple { background: linear-gradient(135deg, #7c3aed 0%, #a78bfa 100%); }
        .stat-icon.green { background: linear-gradient(135deg, #22c55e 0%, #4ade80 100%); }
        .stat-icon.orange { background: linear-gradient(135deg, #f59e0b 0%, #fbbf24 100%); }

        .stat-copy {
            display: flex;
            flex-direction: column;
            gap: 3px;
        }

        .stat-label {
            font-size: 0.7rem;
            letter-spacing: 0.08em;
            text-transform: uppercase;
            color: var(--text-muted);
            font-weight: 700;
        }

        .stat-copy strong {
            font-size: 1.8rem;
            font-weight: 800;
            letter-spacing: -0.06em;
            color: var(--text-main);
        }

        .stat-copy small {
            color: var(--text-muted);
            font-weight: 600;
        }

        .panel-grid {
            display: grid;
            grid-template-columns: minmax(0, 1.1fr) minmax(0, 1fr);
            gap: 18px;
        }

        .card {
            background: var(--card-bg);
            border: 1px solid var(--line);
            border-radius: 24px;
            padding: 20px 18px 18px;
            box-shadow: 0 22px 55px rgba(15, 23, 42, 0.12);
            backdrop-filter: blur(10px);
        }

        .card-title {
            display: flex;
            align-items: center;
            gap: 10px;
            margin-bottom: 18px;
            font-size: 1.16rem;
            font-weight: 800;
            letter-spacing: -0.04em;
        }

        .card-title i {
            color: var(--primary);
            font-size: 1rem;
        }

        .form-stack {
            display: flex;
            flex-direction: column;
            gap: 14px;
        }

        .field-group {
            display: flex;
            flex-direction: column;
            gap: 7px;
        }

        .field-group label {
            font-size: 0.7rem;
            font-weight: 700;
            letter-spacing: 0.12em;
            text-transform: uppercase;
            color: var(--text-muted);
        }

        input,
        select,
        textarea {
            width: 100%;
            border: 1px solid var(--line);
            border-radius: 11px;
            background: linear-gradient(180deg, rgba(255,255,255,0.96), rgba(248,250,252,0.96));
            color: var(--text-main);
            padding: 12px 14px;
            font: inherit;
            transition: border-color 0.2s ease, box-shadow 0.2s ease;
        }

        input:focus,
        select:focus,
        textarea:focus {
            outline: none;
            border-color: var(--primary);
            box-shadow: 0 0 0 4px var(--primary-soft);
        }

        textarea {
            min-height: 120px;
            resize: vertical;
        }

        .btn-action {
            border: none;
            border-radius: 12px;
            background: linear-gradient(135deg, var(--primary) 0%, var(--primary-strong) 100%);
            color: #fff;
            font-weight: 700;
            padding: 12px 16px;
            cursor: pointer;
            box-shadow: 0 12px 22px rgba(37, 99, 235, 0.22);
            transition: transform 0.2s ease;
        }

        .btn-action:hover {
            transform: translateY(-1px);
        }

        .notification-card {
            display: flex;
            flex-direction: column;
            gap: 14px;
        }

        .notification-list {
            display: grid;
            gap: 10px;
        }

        .notification-item {
            border: 1px solid var(--line);
            border-radius: 14px;
            background: rgba(248, 250, 252, 0.9);
            padding: 12px 14px;
        }

        .notification-item strong {
            display: flex;
            align-items: center;
            gap: 8px;
            font-size: 0.92rem;
        }

        .notification-item .status-dot {
            width: 10px;
            height: 10px;
            border-radius: 50%;
            background: var(--success);
            display: inline-block;
        }

        .notification-item small {
            display: block;
            margin-top: 6px;
            color: var(--text-muted);
            font-size: 0.72rem;
        }

        #notificationStatus,
        #msg-box {
            display: none;
            padding: 12px 14px;
            border-radius: 12px;
            font-size: 0.88rem;
            font-weight: 600;
        }

        .directory-card {
            margin-top: 20px;
        }

        .table-container {
            overflow: hidden;
            border: 1px solid var(--line);
            border-radius: 18px;
            background: rgba(255,255,255,0.96);
        }

        table {
            width: 100%;
            border-collapse: separate;
            border-spacing: 0;
        }

        th,
        td {
            padding: 14px 16px;
            text-align: left;
            border-bottom: 1px solid var(--line);
        }

        th {
            background: #f8fafc;
            color: var(--text-muted);
            font-size: 0.7rem;
            letter-spacing: 0.09em;
            text-transform: uppercase;
            font-weight: 700;
        }

        tbody tr:last-child td {
            border-bottom: none;
        }

        tbody tr:hover {
            background: rgba(37, 99, 235, 0.02);
        }

        .role-badge {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            border-radius: 999px;
            padding: 5px 10px;
            font-size: 0.68rem;
            font-weight: 700;
            text-transform: capitalize;
        }

        .role-super_admin { background: rgba(239, 68, 68, 0.12); color: #b91c1c; }
        .role-admin { background: rgba(99, 102, 241, 0.12); color: #4338ca; }
        .role-teacher { background: rgba(16, 185, 129, 0.12); color: #047857; }

        .btn-mini {
            border: 1px solid var(--line);
            background: rgba(255,255,255,0.96);
            color: var(--text-main);
            border-radius: 8px;
            padding: 7px 9px;
            cursor: pointer;
            margin-right: 6px;
        }

        .btn-mini.delete:hover {
            background: rgba(239, 68, 68, 0.06);
            border-color: rgba(239, 68, 68, 0.35);
            color: var(--danger);
        }

        .progress-bar {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 4px;
            background: rgba(37, 99, 235, 0.1);
            z-index: 20;
            display: none;
        }

        .progress-bar span {
            display: block;
            width: 0;
            height: 100%;
            background: linear-gradient(90deg, var(--primary) 0%, var(--primary-strong) 100%);
            transition: width 0.25s ease;
        }

        #superNotificationDropdown {
            position: fixed;
            right: 18px;
            top: 74px;
            width: 360px;
            max-height: 68vh;
            overflow: auto;
            background: var(--card-bg);
            border: 1px solid var(--line);
            border-radius: 18px;
            box-shadow: 0 22px 55px rgba(15, 23, 42, 0.12);
            padding: 10px;
            z-index: 50;
            display: none;
        }

        @media (max-width: 1100px) {
            .stats-row {
                grid-template-columns: repeat(2, minmax(170px, 1fr));
            }
            .panel-grid {
                grid-template-columns: 1fr;
            }
        }

        @media (max-width: 860px) {
            body {
                display: block;
            }

            nav {
                position: static;
                width: 100%;
            }

            main {
                margin-left: 0;
                width: 100%;
                padding: 24px 18px 40px;
            }

            .stats-row {
                grid-template-columns: 1fr;
            }
        }
    </style>
</head>
<body>
    <div id="superProgress" class="progress-bar"><span></span></div>

    <nav>
        <div class="nav-brand">
            <div class="brand-mark"><i class="fas fa-school"></i></div>
            <h1>School</h1>
        </div>

        <div class="nav-menu">
            <a href="admin.html" class="active"><i class="fa-solid fa-gauge-high"></i> Dashboard</a>
            <a href="attendance.html"><i class="fa-solid fa-file-invoice"></i> Attendance</a>
            <a href="teachers.html"><i class="fa-solid fa-users"></i> Teachers</a>
            <a href="super-admin.html"><i class="fa-solid fa-user-gear"></i> User Management</a>
            <a href="report.html"><i class="fa-solid fa-chart-pie"></i> Reports</a>
            <a href="admin-builder.html"><i class="fa-solid fa-gear"></i> Settings</a>
        </div>

        <div class="nav-footer">
            <a href="index.html"><button class="logout-btn">Logout</button></a>
        </div>
    </nav>

    <main>
        <div class="page-shell">
            <header class="page-header">
                <div class="header-copy">
                    <h2>Super Admin Terminal</h2>
                    <p>System User Management &amp; Access Control</p>
                </div>

                <div class="header-actions">
                    <button id="superNotifyBtn" class="icon-btn" type="button" title="Notifications">
                        <i class="fas fa-bell"></i>
                        <span id="superNotifyBadge" class="notification-badge">0</span>
                    </button>
                    <div class="admin-pill"><i class="fas fa-user-shield"></i> Super Admin</div>
                    <button id="themeToggle" class="theme-btn" type="button">Dark mode</button>
                </div>
            </header>

            <div class="stats-row">
                <div class="stat-card">
                    <div class="stat-icon blue"><i class="fa-solid fa-users"></i></div>
                    <div class="stat-copy">
                        <span class="stat-label">Total Users</span>
                        <strong>24</strong>
                        <small>All system users</small>
                    </div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon purple"><i class="fa-solid fa-user-tie"></i></div>
                    <div class="stat-copy">
                        <span class="stat-label">Administrators</span>
                        <strong>3</strong>
                        <small>System admins</small>
                    </div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon green"><i class="fa-solid fa-chalkboard-user"></i></div>
                    <div class="stat-copy">
                        <span class="stat-label">Teachers</span>
                        <strong>18</strong>
                        <small>Registered teachers</small>
                    </div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon orange"><i class="fa-solid fa-shield-check"></i></div>
                    <div class="stat-copy">
                        <span class="stat-label">System Status</span>
                        <strong>Active</strong>
                        <small>Running smoothly</small>
                    </div>
                </div>
            </div>

            <div class="panel-grid">
                <section class="card">
                    <h3 class="card-title"><i class="fa-solid fa-user-plus"></i> Register User</h3>
                    <form id="createUserForm" class="form-stack">
                        <div class="field-group">
                            <label>Full Name</label>
                            <input type="text" id="name" required placeholder="Enter full name">
                        </div>
                        <div class="field-group">
                            <label>Username</label>
                            <input type="text" id="username" required placeholder="Enter username">
                        </div>
                        <div class="field-group">
                            <label>Password</label>
                            <input type="password" id="password" required minlength="6" placeholder="Enter password">
                        </div>
                        <div class="field-group">
                            <label>Role</label>
                            <select id="role">
                                <option value="teacher">Teacher</option>
                                <option value="admin">Admin</option>
                                <option value="super_admin">Super Admin</option>
                            </select>
                        </div>
                        <button type="submit" class="btn-action">Create Account</button>
                        <div id="msg-box"></div>
                    </form>
                </section>

                <section class="card notification-card">
                    <h3 class="card-title"><i class="fa-solid fa-bell"></i> Notification Center</h3>
                    <div class="field-group">
                        <label>Message for administrators or teachers</label>
                        <textarea id="notificationText" placeholder="Inform the system about a change or update..."></textarea>
                    </div>
                    <button id="sendNotification" class="btn-action" type="button">Send Notification</button>
                    <div id="notificationStatus"></div>
                    <div class="notification-list" id="notificationList">
                        <div class="notification-item">
                            <strong><span class="status-dot"></span> System Maintenance</strong>
                            <small>Scheduled for Monday, 10:00 AM</small>
                        </div>
                    </div>
                </section>
            </div>

            <section class="card directory-card">
                <h3 class="card-title"><i class="fa-solid fa-users-gear"></i> Active Directory</h3>
                <div class="table-container">
                    <table>
                        <thead>
                            <tr>
                                <th>User</th>
                                <th>Username</th>
                                <th>Role</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody id="userTableBody">
                            <tr><td colspan="4" style="text-align:center; color: var(--text-muted);">Syncing with database...</td></tr>
                        </tbody>
                    </table>
                </div>
            </section>
        </div>
    </main>

    <div id="superNotificationDropdown">
        <div id="superNotificationList">Loading...</div>
    </div>

    <script>
        const userForm = document.getElementById('createUserForm');
        const msgBox = document.getElementById('msg-box');
        const themeToggle = document.getElementById('themeToggle');
        const notificationText = document.getElementById('notificationText');
        const notificationStatus = document.getElementById('notificationStatus');
        const notificationList = document.getElementById('notificationList');
        const sendNotification = document.getElementById('sendNotification');
        const superProgress = document.getElementById('superProgress');
        const superNotifyBtn = document.getElementById('superNotifyBtn');
        const superNotificationDropdown = document.getElementById('superNotificationDropdown');
        const superNotificationList = document.getElementById('superNotificationList');

        function showSuperProgress() {
            superProgress.style.display = 'block';
            superProgress.firstElementChild.style.width = '20%';
        }

        function updateSuperProgress(percent) {
            superProgress.firstElementChild.style.width = percent + '%';
        }

        function hideSuperProgress() {
            superProgress.firstElementChild.style.width = '100%';
            setTimeout(function () {
                superProgress.style.display = 'none';
                superProgress.firstElementChild.style.width = '0';
            }, 200);
        }

        function setTheme(theme) {
            document.documentElement.dataset.theme = theme;
            localStorage.setItem('smartschool-theme', theme);
            themeToggle.textContent = theme === 'dark' ? 'Light mode' : 'Dark mode';
        }

        function loadTheme() {
            const theme = localStorage.getItem('smartschool-theme') || 'light';
            setTheme(theme);
        }

        async function loadUsers() {
            const tbody = document.getElementById('userTableBody');
            try {
                const res = await fetch('/users');
                const users = await res.json();

                if (Array.isArray(users) && users.length) {
                    tbody.innerHTML = users.map(function (u) {
                        return `
                            <tr>
                                <td><strong>${u.name}</strong></td>
                                <td><code>${u.username}</code></td>
                                <td><span class="role-badge role-${u.role}">${u.role.replace('_', ' ')}</span></td>
                                <td>
                                    <button type="button" class="btn-mini" onclick="resetPassword(${u.id}, '${u.name}')"><i class="fa-solid fa-key"></i></button>
                                    <button type="button" class="btn-mini delete" onclick="deleteUser(${u.id}, '${u.name}')"><i class="fa-solid fa-trash"></i></button>
                                </td>
                            </tr>
                        `;
                    }).join('');
                } else {
                    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; color: var(--text-muted);">No users found.</td></tr>';
                }
            } catch (err) {
                tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; color: #ef4444;">Failed to connect to server.</td></tr>';
            }
        }

        userForm.addEventListener('submit', async function (e) {
            e.preventDefault();
            const payload = {
                name: document.getElementById('name').value,
                username: document.getElementById('username').value,
                password: document.getElementById('password').value,
                role: document.getElementById('role').value
            };

            try {
                const res = await fetch('/users', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                const data = await res.json();

                msgBox.style.display = 'block';
                msgBox.textContent = data.message;
                msgBox.style.background = data.status === 'success' ? '#d1fae5' : '#fee2e2';
                msgBox.style.color = data.status === 'success' ? '#166534' : '#991b1b';

                if (data.status === 'success') {
                    userForm.reset();
                    loadUsers();
                }
            } catch (err) {
                msgBox.style.display = 'block';
                msgBox.textContent = 'Error creating user';
                msgBox.style.background = '#fee2e2';
                msgBox.style.color = '#991b1b';
            }
        });

        window.resetPassword = async function (id, name) {
            const newPass = prompt('New password for ' + name + ':');
            if (!newPass || newPass.length < 6) {
                return alert('Password must be 6 or more characters.');
            }

            const res = await fetch('/users/reset-password/' + id, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ newPassword: newPass })
            });
            const data = await res.json();
            alert(data.message);
        };

        window.deleteUser = async function (id, name) {
            if (!confirm('Delete ' + name + '?')) return;
            const res = await fetch('/users/' + id, { method: 'DELETE' });
            const data = await res.json();
            if (data.status === 'success') loadUsers();
            else alert(data.message);
        };

        async function loadNotifications() {
            showSuperProgress();
            notificationList.innerHTML = '<div class="notification-item"><strong><span class="status-dot"></span> Loading notifications...</strong></div>';

            try {
                const res = await fetch('/messages/notification');
                updateSuperProgress(70);
                const data = await res.json();
                updateSuperProgress(90);

                if (!Array.isArray(data) || data.length === 0) {
                    notificationList.innerHTML = '<div class="notification-item"><strong><span class="status-dot"></span> No notifications</strong><small>Everything is up to date.</small></div>';
                } else {
                    notificationList.innerHTML = data.slice(0, 6).map(function (n) {
                        return `
                            <div class="notification-item">
                                <strong><span class="status-dot"></span> ${n.sender_name || 'System'}</strong>
                                <small>${n.message}</small>
                                <small>${new Date(n.created_at).toLocaleString()}</small>
                            </div>
                        `;
                    }).join('');
                }

                const badge = document.getElementById('superNotifyBadge');
                if (badge) {
                    if (Array.isArray(data) && data.length > 0) {
                        badge.style.display = 'inline-flex';
                        badge.textContent = data.length;
                    } else {
                        badge.style.display = 'none';
                    }
                }

                if (superNotificationList) {
                    if (!Array.isArray(data) || data.length === 0) {
                        superNotificationList.innerHTML = '<div style="padding:12px; color: var(--text-muted);">No notifications</div>';
                    } else {
                        superNotificationList.innerHTML = data.slice(0, 8).map(function (n) {
                            return `
                                <div style="padding:10px 8px; border-bottom:1px solid var(--line);">
                                    <div style="display:flex; justify-content:space-between; gap:10px; align-items:center;">
                                        <strong>${n.sender_name || 'System'}</strong>
                                        <button type="button" class="btn-mini delete" data-notification-id="${n.id}" style="padding:5px 8px; font-size:11px;">Delete</button>
                                    </div>
                                    <small style="color: var(--text-muted); display:block; margin-top:4px;">${new Date(n.created_at).toLocaleString()}</small>
                                    <div style="margin-top:8px; color: var(--text-main);">${n.message}</div>
                                </div>
                            `;
                        }).join('');
                    }
                }

                document.querySelectorAll('.btn-mini.delete[data-notification-id]').forEach(function (button) {
                    button.addEventListener('click', async function () {
                        const id = Number(button.dataset.notificationId);
                        if (!Number.isInteger(id) || id < 1) return;
                        if (!confirm('Delete this notification?')) return;

                        try {
                            const response = await fetch('/messages/notification/' + id, { method: 'DELETE' });
                            const result = await response.json();
                            if (!response.ok || result.status !== 'success') throw new Error(result.message || 'Unable to delete notification.');
                            loadNotifications();
                        } catch (error) {
                            alert(error.message || 'Unable to delete notification.');
                        }
                    });
                });
            } catch (err) {
                notificationList.innerHTML = '<div class="notification-item"><strong><span class="status-dot"></span> Unable to load notifications</strong></div>';
            } finally {
                hideSuperProgress();
            }
        }

        async function sendAdminNotification() {
            const message = notificationText.value.trim();
            if (!message) {
                notificationStatus.style.display = 'block';
                notificationStatus.style.background = '#fee2e2';
                notificationStatus.style.color = '#991b1b';
                notificationStatus.textContent = 'Please enter a notification message.';
                return;
            }

            sendNotification.disabled = true;
            sendNotification.textContent = 'Sending...';

            try {
                const res = await fetch('/messages/notification', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ message: message })
                });
                const data = await res.json();
                notificationStatus.style.display = 'block';
                notificationStatus.style.background = data.status === 'success' ? '#d1fae5' : '#fee2e2';
                notificationStatus.style.color = data.status === 'success' ? '#166534' : '#991b1b';
                notificationStatus.textContent = data.message;

                if (data.status === 'success') {
                    notificationText.value = '';
                    loadNotifications();
                }
            } catch (err) {
                notificationStatus.style.display = 'block';
                notificationStatus.style.background = '#fee2e2';
                notificationStatus.style.color = '#991b1b';
                notificationStatus.textContent = 'Unable to send notification. Try again.';
            } finally {
                sendNotification.disabled = false;
                sendNotification.textContent = 'Send Notification';
            }
        }

        if (superNotifyBtn) {
            superNotifyBtn.addEventListener('click', function () {
                if (!superNotificationDropdown) return;
                const visible = superNotificationDropdown.style.display === 'block';
                superNotificationDropdown.style.display = visible ? 'none' : 'block';
                if (!visible) loadNotifications();
            });
        }

        themeToggle.addEventListener('click', function () {
            const nextTheme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
            setTheme(nextTheme);
        });

        sendNotification.addEventListener('click', sendAdminNotification);

        loadTheme();
        loadUsers();
        loadNotifications();
    </script>
</body>
</html>
'''

path = Path('public/super-admin.html')
path.write_text(html, encoding='utf-8')
print('updated super-admin.html')
