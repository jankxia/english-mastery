from flask import Flask, request, redirect, url_for, session, flash, send_from_directory, send_file
from flask_sqlalchemy import SQLAlchemy
from flask_bcrypt import Bcrypt
import os

app = Flask(__name__)
app.config['SECRET_KEY'] = 'english-mastery-secret-2026'
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///english.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db = SQLAlchemy(app)
bcrypt = Bcrypt(app)

# ========== 数据库模型 ==========
class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    password = db.Column(db.String(120), nullable=False)
    role = db.Column(db.String(20), default="user") # admin / user
    status = db.Column(db.Integer, default=1) # 1启用 0禁用

# 用户学习答题数据，自动绑定用户ID，隔离
class UserStudyRecord(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    record_json = db.Column(db.Text)

# 系统配置
class SysConfig(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    key = db.Column(db.String(50), unique=True)
    value = db.Column(db.String(50))

# ========== 工具函数 ==========
def get_config(key):
    r = SysConfig.query.filter_by(key=key).first()
    return r.value if r else "1"

def is_login():
    return 'uid' in session

def get_current_user():
    if not is_login():
        return None
    return User.query.get(session['uid'])

# 页脚HTML（仅用于登录/注册/改密/后台页面）
FOOTER_HTML = """
<div style="margin-top:40px;padding:20px;border-top:1px solid #ccc;font-size:12px;color:#666;">
<p>免责声明：本系统仅供个人学习交流使用，题库内容与解析仅作参考，不构成正式教学指导。</p>
<p>可选登录地址： <a href="https://en.717611.xyz/">https://en.717611.xyz/</a> · <a href="https://en.xhx.xx.kg/">https://en.xhx.xx.kg/</a> · <a href="https://en.xnas.us.kg/">https://en.xnas.us.kg/</a> · <a href="https://en.xnas.cc.cd/">https://en.xnas.cc.cd/</a> · <a href="https://en.611.us.ci/">https://en.611.us.ci/</a></p>
<p>联系邮箱： <a href="mailto:jankxia@163.com">jankxia@163.com</a></p>
</div>
"""

# ========== 前端页面路由【重点修改】 ==========
@app.route('/')
def index_page():
    if not is_login():
        return redirect(url_for('login'))
    # send_file：直接返回文件，不经过Jinja模板引擎，不会解析{{ }}
    return send_file("index.html")

@app.route('/standalone')
def standalone_page():
    if not is_login():
        return redirect(url_for('login'))
    # 完全原样读取english-mastery-standalone.html，不做任何处理
    return send_file("english-mastery-standalone.html")

# ========== 登录注册相关路由 ==========
@app.route('/login', methods=['GET','POST'])
def login():
    u = get_current_user()
    if u:
        return redirect(url_for('index_page'))
    if request.method == 'POST':
        uname = request.form['username']
        pwd = request.form['password']
        user = User.query.filter_by(username=uname).first()
        if user and user.status ==1 and bcrypt.check_password_hash(user.password, pwd):
            session['uid'] = user.id
            return redirect(url_for('index_page'))
        flash("账号密码错误或账号已禁用")
    login_tpl = """
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>登录 English-Mastery</title>
<style>
body {
    background: url("/bg.webp") no-repeat center center;
    background-size: cover;
    min-height: 100vh;
    margin:0;
}
.box{
    background:rgba(255,255,255,0.85);
    max-width:500px;
    margin:80px auto;
    padding:20px;
    border-radius:8px;
}
</style>
</head>
<body>
<div class="box">
<h2>登录</h2>
<form method="post">
<p>账号：<input name="username" style="width:100%;padding:6px;"></p>
<p>密码：<input type="password" name="password" style="width:100%;padding:6px;"></p>
<p><button type="submit" style="padding:6px 16px;">登录</button></p>
</form>
<p><a href="/register">注册账号</a></p>
""" + FOOTER_HTML + """
</div>
</body>
</html>
"""
    return render_template_string(login_tpl)

@app.route('/register', methods=['GET','POST'])
def register():
    if get_config("register_open") != "1":
        close_tpl = """
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>注册关闭</title>
<style>
body {
    background: url("/bg.webp") no-repeat center center;
    background-size: cover;
    min-height: 100vh;
    margin:0;
}
.box{
    background:rgba(255,255,255,0.85);
    max-width:500px;
    margin:80px auto;
    padding:20px;
    border-radius:8px;
}
</style>
</head>
<body>
<div class="box">
<h2>注册功能已关闭，请联系管理员</h2>
<p><a href="/login">返回登录</a></p>
""" + FOOTER_HTML + """
</div>
</body>
</html>
"""
        return render_template_string(close_tpl)
    if request.method == 'POST':
        uname = request.form['username']
        pwd = request.form['password']
        if User.query.filter_by(username=uname).first():
            flash("账号已存在")
        else:
            hash_pwd = bcrypt.generate_password_hash(pwd).decode('utf-8')
            new_user = User(username=uname, password=hash_pwd)
            db.session.add(new_user)
            db.session.commit()
            return redirect(url_for('login'))
    reg_tpl = """
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>注册账号</title>
<style>
body {
    background: url("/bg.webp") no-repeat center center;
    background-size: cover;
    min-height: 100vh;
    margin:0;
}
.box{
    background:rgba(255,255,255,0.85);
    max-width:500px;
    margin:80px auto;
    padding:20px;
    border-radius:8px;
}
</style>
</head>
<body>
<div class="box">
<h2>注册</h2>
<form method="post">
<p>账号：<input name="username" style="width:100%;padding:6px;"></p>
<p>密码：<input type="password" name="password" style="width:100%;padding:6px;"></p>
<p><button type="submit" style="padding:6px 16px;">注册</button></p>
</form>
<p><a href="/login">返回登录</a></p>
""" + FOOTER_HTML + """
</div>
</body>
</html>
"""
    return render_template_string(reg_tpl)

@app.route('/change_pwd', methods=['GET','POST'])
def change_pwd():
    u = get_current_user()
    if not u:
        return redirect(url_for('login'))
    if request.method == 'POST':
        old = request.form['old']
        new = request.form['new']
        if bcrypt.check_password_hash(u.password, old):
            u.password = bcrypt.generate_password_hash(new).decode('utf-8')
            db.session.commit()
            flash("密码修改成功！")
            return redirect(url_for('index_page'))
        flash("原密码错误")
    pwd_tpl = """
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>修改密码</title>
<style>
body {
    background: url("/bg.webp") no-repeat center center;
    background-size: cover;
    min-height: 100vh;
    margin:0;
}
.box{
    background:rgba(255,255,255,0.85);
    max-width:500px;
    margin:80px auto;
    padding:20px;
    border-radius:8px;
}
</style>
</head>
<body>
<div class="box">
<h2>修改密码</h2>
<form method="post">
<p>原密码：<input type="password" name="old" style="width:100%;padding:6px;"></p>
<p>新密码：<input type="password" name="new" style="width:100%;padding:6px;"></p>
<p><button type="submit" style="padding:6px 16px;">提交修改</button></p>
</form>
<p><a href='/'>返回首页</a></p>
""" + FOOTER_HTML + """
</div>
</body>
</html>
"""
    return render_template_string(pwd_tpl)

@app.route('/admin', methods=['GET','POST'])
def admin_panel():
    u = get_current_user()
    if not u or u.role != "admin":
        return redirect(url_for('index_page'))
    # 修改注册开关
    if request.form.get('reg_open'):
        cfg = SysConfig.query.filter_by(key="register_open").first()
        cfg.value = request.form['reg_open']
        db.session.commit()
    # 用户启用/禁用
    if request.form.get('toggle_uid'):
        tu = User.query.get(request.form['toggle_uid'])
        tu.status = 1 - tu.status
        db.session.commit()
    reg_open = get_config("register_open")
    users = User.query.all()
    body = f"""
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>管理员后台</title>
<style>
body {{
    background: url("/bg.webp") no-repeat center center;
    background-size: cover;
    min-height: 100vh;
    margin:0;
}}
.box{{
    background:rgba(255,255,255,0.85);
    max-width:800px;
    margin:40px auto;
    padding:20px;
    border-radius:8px;
}}
</style>
</head>
<body>
<div class="box">
<h2>管理员后台</h2>
<form method="post">
    <p>公开注册：
    <select name="reg_open">
        <option value="1" {"selected" if reg_open=="1" else ""}>开启注册</option>
        <option value="0" {"selected" if reg_open=="0" else ""}>关闭注册</option>
    </select>
    <button type="submit">保存设置</button>
    </p>
</form>
<h3>全部用户列表</h3>
"""
    for us in users:
        status_txt = "✅启用" if us.status else "❌禁用"
        body += f"<p>{us.username} | 角色:{us.role} | {status_txt} <form method='post' style='display:inline'><input name='toggle_uid' value='{us.id}' hidden><button>切换账号状态</button></form></p>"
    body += "<p><a href='/'>返回学习主页</a></p>" + FOOTER_HTML + "</div></body></html>"
    return render_template_string(body)

@app.route('/logout')
def logout():
    session.clear()
    return redirect(url_for('login'))

# ========== ✅托管根目录静态文件，解决 styles.css / js/*.js / bg.webp 404 ==========
# 必须放在所有业务路由最后！
@app.route('/<path:filename>')
def serve_root_static(filename):
    return send_from_directory(os.path.dirname(__file__), filename)

# ========== 初始化数据库，创建管理员账号 admin / 123456 ==========
with app.app_context():
    db.create_all()
    # 初始化注册开关
    if not SysConfig.query.filter_by(key="register_open").first():
        db.session.add(SysConfig(key="register_open", value="1"))
    # 初始化管理员账号 admin / 123456
    if not User.query.filter_by(username="admin").first():
        hashpwd = bcrypt.generate_password_hash("123456").decode('utf-8')
        db.session.add(User(username="admin", password=hashpwd, role="admin"))
    db.session.commit()

if __name__ == '__main__':
    app.run(debug=False, host="0.0.0.0", port=3007)
