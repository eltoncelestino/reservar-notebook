from flask import Flask, render_template, request, redirect, url_for, flash, session
from functools import wraps
import os
import shutil
import sqlite3
from datetime import datetime

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
ENV_FILE = os.path.join(BASE_DIR, ".env")
if os.path.exists(ENV_FILE):
    with open(ENV_FILE, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1)
                os.environ.setdefault(k.strip(), v.strip())

app = Flask(__name__)
app.secret_key = os.environ.get("SECRET_KEY", "altere-esta-chave-em-producao")

DB_DIR = os.environ.get("DB_DIR", BASE_DIR)
DB_NAME = os.environ.get("DB_NAME", "db_reservar_notebook.db")
DB = os.path.join(DB_DIR, DB_NAME)

ADMIN_USUARIO = os.environ.get("ADMIN_USUARIO", "admin")
ADMIN_SENHA = os.environ.get("ADMIN_SENHA", "admin123")


@app.context_processor
def inject_branding():
    return {"logo_empresa": os.environ.get("LOGO_EMPRESA", "").strip()}

_GRUPAMENTOS_PADRAO = [
    "Engenharia de Software",
    "Design de Produto (UI/UX)",
    "Infraestrutura e Cloud",
    "Qualidade de Software (QA)",
    "Dados e Analytics",
    "Segurança da Informação",
    "Suporte Técnico",
    "Produtos Digitais",
    "Comercial e Parcerias",
    "Financeiro e Administrativo",
]
_env_grupamentos = os.environ.get("GRUPAMENTOS", "").strip()
GRUPAMENTOS = (
    [g.strip() for g in _env_grupamentos.split(",") if g.strip()]
    if _env_grupamentos
    else _GRUPAMENTOS_PADRAO
)
FINALIDADES = ["Apresentação", "Feedback", "Reunião com cliente", "Outro"]


def get_conn():
    conn = sqlite3.connect(DB, timeout=15)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    os.makedirs(DB_DIR, exist_ok=True)
    old_net_db = os.path.join(DB_DIR, "database.db")
    if not os.path.exists(DB) and os.path.exists(old_net_db):
        os.replace(old_net_db, DB)
    local_db = os.path.join(os.path.dirname(os.path.abspath(__file__)), "db_reservar_notebook.db")
    if not os.path.exists(DB) and os.path.exists(local_db):
        shutil.copy2(local_db, DB)
    with get_conn() as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS reservas (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                solicitante TEXT NOT NULL,
                grupamento TEXT NOT NULL,
                data_inicio TEXT NOT NULL,
                data_fim TEXT NOT NULL,
                finalidade TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'Reservado',
                retirada_em TEXT,
                devolucao_em TEXT,
                observacao TEXT,
                criado_em TEXT NOT NULL
            )
        """)


def tem_conflito(conn, inicio, fim, ignorar_id=None):
    if ignorar_id is not None:
        row = conn.execute("""
            SELECT 1 FROM reservas
            WHERE status IN ('Reservado', 'Em uso')
              AND id != ?
              AND data_inicio < ? AND data_fim > ?
            LIMIT 1
        """, (ignorar_id, fim, inicio)).fetchone()
    else:
        row = conn.execute("""
            SELECT 1 FROM reservas
            WHERE status IN ('Reservado', 'Em uso')
              AND data_inicio < ? AND data_fim > ?
            LIMIT 1
        """, (fim, inicio)).fetchone()
    return row is not None


@app.route("/")
@app.route("/sistema-reservar-notebook")
def index():
    dados_form = session.pop("dados_form", {})
    erro_data = session.pop("erro_data", False)
    page_agenda = max(1, request.args.get("page", 1, type=int))
    per_page_agenda = 5

    with get_conn() as conn:
        agenda_all = conn.execute("""
            SELECT * FROM reservas
            WHERE status IN ('Reservado', 'Em uso')
            ORDER BY data_inicio ASC
        """).fetchall()

    total_agenda = len(agenda_all)
    em_uso_agora = any(r["status"] == "Em uso" for r in agenda_all)
    pages_agenda = max(1, (total_agenda + per_page_agenda - 1) // per_page_agenda)
    page_agenda = min(page_agenda, pages_agenda)
    agenda = agenda_all[(page_agenda - 1) * per_page_agenda : page_agenda * per_page_agenda]

    return render_template(
        "index.html",
        agenda=agenda,
        grupamentos=GRUPAMENTOS,
        finalidades=FINALIDADES,
        dados_form=dados_form,
        erro_data=erro_data,
        total_agenda=total_agenda,
        em_uso_agora=em_uso_agora,
        page_agenda=page_agenda,
        pages_agenda=pages_agenda,
        per_page_agenda=per_page_agenda,
    )


@app.route("/reservar", methods=["POST"])
def reservar():
    nome = request.form.get("solicitante", "").strip()
    grupamento = request.form.get("grupamento", "").strip()
    inicio = request.form.get("data_inicio", "")
    fim = request.form.get("data_fim", "")
    finalidade = request.form.get("finalidade", "").strip()

    dados_base = {
        "solicitante": nome,
        "grupamento": grupamento,
        "finalidade": finalidade,
    }

    if not all([nome, grupamento, inicio, fim, finalidade]):
        session["dados_form"] = {**dados_base, "data_inicio": inicio, "data_fim": fim}
        flash("Preencha todos os campos.", "erro")
        return redirect(url_for("index"))
    try:
        dt_ini = datetime.fromisoformat(inicio)
        dt_fim = datetime.fromisoformat(fim)
    except ValueError:
        session["dados_form"] = dados_base
        session["erro_data"] = True
        flash("Data/hora inválida. Informe uma nova data ou horário.", "erro")
        return redirect(url_for("index"))
    if dt_fim <= dt_ini:
        session["dados_form"] = dados_base
        session["erro_data"] = True
        flash("O término deve ser posterior ao início. Informe uma nova data ou horário.", "erro")
        return redirect(url_for("index"))
    if dt_ini < datetime.now():
        session["dados_form"] = dados_base
        session["erro_data"] = True
        flash("O início não pode estar no passado. Informe uma nova data ou horário.", "erro")
        return redirect(url_for("index"))

    with get_conn() as conn:
        conn.execute("BEGIN IMMEDIATE")
        if tem_conflito(conn, inicio, fim):
            session["dados_form"] = dados_base
            session["erro_data"] = True
            flash("O notebook já está reservado nesse período. Por favor, selecione uma nova data ou horário.", "erro")
            return redirect(url_for("index"))
        conn.execute("""
            INSERT INTO reservas
            (solicitante, grupamento, data_inicio, data_fim, finalidade, criado_em)
            VALUES (?, ?, ?, ?, ?, ?)
        """, (nome, grupamento, inicio, fim, finalidade,
              datetime.now().isoformat(timespec="seconds")))
    flash("Reserva realizada com sucesso!", "ok")
    return redirect(url_for("index"))


def admin_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        if not session.get("admin_logado"):
            flash("Faça login como administrador para acessar o painel.", "erro")
            return redirect(url_for("login_admin"))
        return f(*args, **kwargs)
    return decorated


@app.route("/login", methods=["GET", "POST"])
def login_admin():
    if session.get("admin_logado"):
        return redirect(url_for("painel_admin"))
    if request.method == "POST":
        usuario = request.form.get("usuario", "").strip()
        senha = request.form.get("senha", "")
        if usuario == ADMIN_USUARIO and senha == ADMIN_SENHA:
            session["admin_logado"] = True
            flash("Login realizado com sucesso.", "ok")
            return redirect(url_for("painel_admin"))
        flash("Usuário ou senha incorretos.", "erro")
    return render_template("login.html")


@app.route("/logout")
def logout_admin():
    session.pop("admin_logado", None)
    flash("Você saiu do Painel do Administrador.", "ok")
    return redirect(url_for("index"))


@app.route("/alan")
def painel_alan():
    return redirect(url_for("painel_admin"))


@app.route("/admin")
@admin_required
def painel_admin():
    page_ativas = max(1, request.args.get("page_ativas", 1, type=int))
    page_hist = max(1, request.args.get("page_hist", 1, type=int))
    per_page_ativas = 10
    per_page_hist = 10

    with get_conn() as conn:
        ativas_all = conn.execute("""
            SELECT * FROM reservas
            WHERE status IN ('Reservado', 'Em uso')
            ORDER BY data_inicio ASC
        """).fetchall()
        historico_all = conn.execute("""
            SELECT * FROM reservas
            WHERE status IN ('Devolvido', 'Cancelado')
            ORDER BY id DESC
        """).fetchall()

    total_pendentes = sum(1 for r in ativas_all if r["status"] == "Reservado")
    total_em_uso = sum(1 for r in ativas_all if r["status"] == "Em uso")
    total_devolvidos = sum(1 for r in historico_all if r["status"] == "Devolvido")

    total_ativas = len(ativas_all)
    pages_ativas = max(1, (total_ativas + per_page_ativas - 1) // per_page_ativas)
    page_ativas = min(page_ativas, pages_ativas)
    ativas = ativas_all[(page_ativas - 1) * per_page_ativas : page_ativas * per_page_ativas]

    total_hist = len(historico_all)
    pages_hist = max(1, (total_hist + per_page_hist - 1) // per_page_hist)
    page_hist = min(page_hist, pages_hist)
    historico = historico_all[(page_hist - 1) * per_page_hist : page_hist * per_page_hist]

    return render_template(
        "alan.html",
        ativas=ativas,
        historico=historico,
        grupamentos=GRUPAMENTOS,
        finalidades=FINALIDADES,
        total_pendentes=total_pendentes,
        total_em_uso=total_em_uso,
        total_devolvidos=total_devolvidos,
        total_ativas=total_ativas,
        page_ativas=page_ativas,
        pages_ativas=pages_ativas,
        per_page_ativas=per_page_ativas,
        total_hist=total_hist,
        page_hist=page_hist,
        pages_hist=pages_hist,
        per_page_hist=per_page_hist,
    )


@app.route("/admin/editar/<int:id>", methods=["POST"])
@admin_required
def editar(id):
    nome = request.form.get("solicitante", "").strip()
    grupamento = request.form.get("grupamento", "").strip()
    inicio = request.form.get("data_inicio", "")
    fim = request.form.get("data_fim", "")
    finalidade = request.form.get("finalidade", "").strip()

    if not all([nome, grupamento, inicio, fim, finalidade]):
        flash("Preencha todos os campos para atualizar o agendamento.", "erro")
        return redirect(url_for("painel_admin"))
    try:
        dt_ini = datetime.fromisoformat(inicio)
        dt_fim = datetime.fromisoformat(fim)
    except ValueError:
        flash("Data ou horário inválido na edição.", "erro")
        return redirect(url_for("painel_admin"))
    if dt_fim <= dt_ini:
        flash("O término deve ser posterior ao início.", "erro")
        return redirect(url_for("painel_admin"))

    with get_conn() as conn:
        conn.execute("BEGIN IMMEDIATE")
        if tem_conflito(conn, inicio, fim, ignorar_id=id):
            flash("Já existe outro agendamento ativo nesse período.", "erro")
            return redirect(url_for("painel_admin"))
        conn.execute("""
            UPDATE reservas
            SET solicitante=?, grupamento=?, data_inicio=?, data_fim=?, finalidade=?
            WHERE id=? AND status IN ('Reservado', 'Em uso')
        """, (nome, grupamento, inicio, fim, finalidade, id))
    flash("Agendamento atualizado com sucesso!", "ok")
    return redirect(url_for("painel_admin"))


@app.route("/admin/retirada/<int:id>", methods=["POST"])
@admin_required
def retirada(id):
    with get_conn() as conn:
        conn.execute("""
            UPDATE reservas SET status='Em uso', retirada_em=?
            WHERE id=? AND status='Reservado'
        """, (datetime.now().isoformat(timespec="seconds"), id))
    flash("Retirada registrada.", "ok")
    return redirect(url_for("painel_admin"))


@app.route("/admin/devolucao/<int:id>", methods=["POST"])
@admin_required
def devolucao(id):
    carregador = "Sim" if request.form.get("carregador") else "NÃO"
    sem_avarias = "Sem avarias" if request.form.get("sem_avarias") else "COM AVARIAS"
    obs = request.form.get("observacao", "").strip()
    resumo = f"Carregador: {carregador} | Estado: {sem_avarias}"
    if obs:
        resumo += f" | {obs}"
    with get_conn() as conn:
        conn.execute("""
            UPDATE reservas SET status='Devolvido', devolucao_em=?, observacao=?
            WHERE id=? AND status='Em uso'
        """, (datetime.now().isoformat(timespec="seconds"), resumo, id))
    flash("Devolução registrada.", "ok")
    return redirect(url_for("painel_admin"))


@app.route("/admin/cancelar/<int:id>", methods=["POST"])
@admin_required
def cancelar(id):
    justificativa = request.form.get("justificativa", "").strip()
    if not justificativa:
        flash("Informe uma justificativa para cancelar a reserva.", "erro")
        return redirect(url_for("painel_admin"))
    motivo = f"Motivo do cancelamento: {justificativa}"
    with get_conn() as conn:
        conn.execute("""
            UPDATE reservas SET status='Cancelado', observacao=?
            WHERE id=? AND status='Reservado'
        """, (motivo, id))
    flash("Reserva cancelada com sucesso.", "ok")
    return redirect(url_for("painel_admin"))


init_db()

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=False)
