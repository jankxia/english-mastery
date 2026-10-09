from flask import Flask, render_template_string, request, redirect, url_for, session, flash
from flask_sqlalchemy import SQLAlchemy
from flask_bcrypt import Bcrypt

app = Flask(__name__)
app.config['SECRET_KEY'] = 'simple-secret-123'
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///simple.db'
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

# 学习数据（自动绑定user_id，隔离数据）
class StudyData(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    content = db.Column(db.String(500))

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

# ========== 页面模板（全部写在字符串，不用单独html文件） ==========
footer_html = """
<div style="margin-top:40px;padding:20px;border-top:1px solid #ccc;font-size:12px;color:#666;">
<p>免责声明：本系统仅供个人学习交流使用，题库内容与解析仅作参考，不构成正式教学指导。</p>
<p>可选登录地址： <a href="https://en.717611.xyz/">https://en.717611.xyz/</a> · <a href="https://en.xhx.xx.kg/">https://en.xhx.xx.kg/</a> · <a href="https://en.xnas.us.kg/">https://en.xnas.us.kg/</a> · <a href="https://en.xnas.cc.cd/">https://en.xnas.cc.cd/</a> · <a href="https://en.611.us.ci/">https://en.611.us.ci/</a></p>
<p>联系邮箱： <a href="mailto:jankxia@163.com">jankxia@163.com</a></p>
</div>
"""

base_html = """
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>{{title}}</title>
</head>
<body style="max-width:900px;margin:0 auto;padding:20px;">
{{body}}
""" + footer_html + """
</body>
</html>
"""

# ========== 路由 ==========
@app.route('/')
def index():
    u = get_current_user()
    if not u:
        return redirect(url_for('login'))
    body = f"<h2>欢迎 {u.username}</h2><p><a href='/study'>我的学习数据</a></p><p><a href='/change_pwd'>修改密码</a></p>"
    if u.role == "admin":
        body += "<p><a href='/admin'>管理员后台</a></p>"
    body += "<p><a href='/logout'>退出登录</a></p>"
    return render_template_string(base_html, title="首页", body=body)

@app.route('/login', methods=['GET','POST'])
def login():
    if request.method == 'POST':
        uname = request.form['username']
        pwd = request.form['password']
        user = User.query.filter_by(username=uname).first()
        if user and user.status ==1 and bcrypt.check_password_hash(user.password, pwd):
            session['uid'] = user.id
            return redirect(url_for('index'))
        flash("账号密码错误或账号已禁用")
    body = """
    <h2>登录</h2>
    <form method="post">
        <p>账号：<input name="username"></p>
        <p>密码：<input type="password" name="password"></p>
        <p><button type="submit">登录</button></p>
    </form>
    <p><a href="/register">注册账号</a></p>
    """
    return render_template_string(base_html, title="登录", body=body)

@app.route('/register', methods=['GET','POST'])
def register():
    if get_config("register_open") != "1":
        body = "<h2>注册已关闭，请联系管理员</h2>"
        return render_template_string(base_html, title="注册", body=body)
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
    body = """
    <h2>注册</h2>
    <form method="post">
        <p>账号：<input name="username"></p>
        <p>密码：<input type="password" name="password"></p>
        <p><button type="submit">注册</button></p>
    </form>
    <p><a href="/login">返回登录</a></p>
    """
    return render_template_string(base_html, title="注册", body=body)

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
            flash("密码修改成功")
            return redirect(url_for('index'))
        flash("原密码错误")
    body = """
    <h2>修改密码</h2>
    <form method="post">
        <p>原密码：<input type="password" name="old"></p>
        <p>新密码：<input type="password" name="new"></p>
        <p><button type="submit">提交</button></p>
    </form>
    <p><a href="/">返回首页</a></p>
    """
    return render_template_string(base_html, title="改密码", body=body)

@app.route('/study', methods=['GET','POST'])
def study():
    u = get_current_user()
    if not u:
        return redirect(url_for('login'))
    if request.method == 'POST':
        data = StudyData(user_id=u.id, content=request.form['content'])
        db.session.add(data)
        db.session.commit()
    mydata = StudyData.query.filter_by(user_id=u.id).all()
    body = "<h2>我的学习数据（其他人看不到）</h2>"
    body += "<form method='post'><p>新增记录：<input name='content'><button>保存</button></p></form>"
    for d in mydata:
        body += f"<p>{d.id}: {d.content}</p>"
    body += "<p><a href='/'>返回首页</a></p>"
    return render_template_string(base_html, title="学习数据", body=body)

@app.route('/admin', methods=['GET','POST'])
def admin():
    u = get_current_user()
    if not u or u.role != "admin":
        return redirect(url_for('index'))
    # 修改注册开关
    if request.form.get('reg_open'):
        cfg = SysConfig.query.filter_by(key="register_open").first()
        cfg.value = request.form['reg_open']
        db.session.commit()
    # 用户启用禁用
    if request.form.get('toggle_uid'):
        tu = User.query.get(request.form['toggle_uid'])
        tu.status = 1 - tu.status
        db.session.commit()
    reg_open = get_config("register_open")
    users = User.query.all()
    body = "<h2>管理员后台</h2>"
    body += f"""
    <form method="post">
        <p>公开注册：
        <select name="reg_open">
            <option value="1" {"selected" if reg_open=="1" else ""}>开启</option>
            <option value="0" {"selected" if reg_open=="0" else ""}>关闭</option>
        </select>
        <button type="submit">保存设置</button>
        </p>
    </form>
    """
    body += "<h3>用户列表</h3>"
    for us in users:
        status_txt = "启用" if us.status else "禁用"
        body += f"<p>{us.username} | {us.role} | {status_txt} <form method='post' style='display:inline'><input name='toggle_uid' value='{us.id}' hidden><button>切换状态</button></form></p>"
    body += "<p><a href='/'>返回首页</a></p>"
    return render_template_string(base_html, title="管理员", body=body)

@app.route('/logout')
def logout():
    session.clear()
    return redirect(url_for('login'))

# ========== 初始化数据库，创建管理员账号 ==========
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
    app.run(debug=True, host="0.0.0.0", port=5000)
