import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import {
  Activity,
  ArrowRight,
  Boxes,
  FolderGit2,
  LogOut,
  Plus,
  RefreshCw,
  X,
} from "lucide-react";
import { APIError, createProject, listProjects, Project } from "./lib/api";
import {
  clearDemoSession,
  createDemoProject,
  DEMO_EMAIL,
  DEMO_PASSWORD,
  isDemoSession,
  readDemoProjects,
  startDemoSession,
} from "./lib/mock";

const TOKEN_STORAGE_KEY = "fluxcore.api_token";
type AuthMode = "token" | "demo" | null;

function readStoredToken(): string {
  return sessionStorage.getItem(TOKEN_STORAGE_KEY) || "";
}

function App() {
  const [token, setToken] = useState(readStoredToken);
  const [tokenDraft, setTokenDraft] = useState(readStoredToken);
  const [authMode, setAuthMode] = useState<AuthMode>(() => {
    if (isDemoSession()) return "demo";
    return readStoredToken() ? "token" : null;
  });
  const [demoEmailDraft, setDemoEmailDraft] = useState(DEMO_EMAIL);
  const [demoPasswordDraft, setDemoPasswordDraft] = useState(DEMO_PASSWORD);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const requestVersion = useRef(0);

  const loadProjects = useCallback(async () => {
    if (!authMode) return;
    const version = ++requestVersion.current;
    setLoading(true);
    setError(null);
    try {
      if (authMode === "demo") {
        setProjects(readDemoProjects());
        return;
      }

      if (!token) return;
      const response = await listProjects(token);
      if (version !== requestVersion.current) return;
      setProjects(response.projects);
    } catch (requestError) {
      if (version !== requestVersion.current) return;
      if (requestError instanceof APIError && requestError.status === 401) {
        sessionStorage.removeItem(TOKEN_STORAGE_KEY);
        setToken("");
        setTokenDraft("");
        setAuthMode(null);
        setProjects([]);
        setError("API token 无效或已失效，请重新输入。");
      } else {
        setError(requestError instanceof Error ? requestError.message : "项目加载失败");
      }
    } finally {
      if (version === requestVersion.current) setLoading(false);
    }
  }, [authMode, token]);

  useEffect(() => {
    void loadProjects();
    return () => { requestVersion.current += 1; };
  }, [loadProjects]);

  function saveToken(event: FormEvent) {
    event.preventDefault();
    const nextToken = tokenDraft.trim();
    if (!nextToken) return;
    clearDemoSession();
    sessionStorage.setItem(TOKEN_STORAGE_KEY, nextToken);
    setError(null);
    setToken(nextToken);
    setAuthMode("token");
  }

  function saveDemoSession(event: FormEvent) {
    event.preventDefault();
    if (demoEmailDraft.trim() !== DEMO_EMAIL || demoPasswordDraft !== DEMO_PASSWORD) {
      setError("Demo 账号或密码不正确。");
      return;
    }
    sessionStorage.removeItem(TOKEN_STORAGE_KEY);
    startDemoSession();
    setToken("");
    setTokenDraft("");
    setError(null);
    setAuthMode("demo");
  }

  function signOut() {
    requestVersion.current += 1;
    sessionStorage.removeItem(TOKEN_STORAGE_KEY);
    clearDemoSession();
    setToken("");
    setTokenDraft("");
    setAuthMode(null);
    setProjects([]);
    setShowCreate(false);
    setError(null);
    setLoading(false);
  }

  if (!authMode) {
    return (
      <main className="auth-shell">
        <section className="auth-panel" aria-labelledby="token-title">
          <div className="brand-mark">FC</div>
          <p className="eyebrow">LOCAL DEVELOPMENT CONSOLE</p>
          <h1 id="token-title">连接你的 FluxCore</h1>
          <p className="auth-copy">输入本机服务的 API token，开始查看项目状态。</p>
          <form className="token-form" onSubmit={saveToken}>
            <label htmlFor="api-token">API token</label>
            <input
              id="api-token"
              type="password"
              value={tokenDraft}
              onChange={(event) => setTokenDraft(event.target.value)}
              placeholder="粘贴本机 API_TOKEN"
              autoFocus
            />
            <button className="primary-button" type="submit" disabled={!tokenDraft.trim()}>
              进入控制台 <ArrowRight size={16} aria-hidden="true" />
            </button>
          </form>
          {error && <p className="form-error" role="alert">{error}</p>}
          <p className="auth-footnote">token 仅保存在当前浏览器会话中。</p>
          <div className="auth-divider"><span>或</span></div>
          <div className="demo-login">
            <p className="eyebrow">LOCAL DEMO</p>
            <h2>查看演示工作区</h2>
            <p className="demo-copy">使用预置的本地 mock 数据，不会连接后端或修改真实项目。</p>
            <form className="demo-form" onSubmit={saveDemoSession}>
              <label htmlFor="demo-email">Demo 账号</label>
              <input
                id="demo-email"
                type="email"
                value={demoEmailDraft}
                onChange={(event) => setDemoEmailDraft(event.target.value)}
              />
              <label htmlFor="demo-password">Demo 密码</label>
              <input
                id="demo-password"
                type="text"
                value={demoPasswordDraft}
                onChange={(event) => setDemoPasswordDraft(event.target.value)}
              />
              <button className="secondary-button demo-button" type="submit">
                进入演示 <ArrowRight size={15} aria-hidden="true" />
              </button>
            </form>
          </div>
        </section>
      </main>
    );
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-brand"><span className="brand-mark small">FC</span><span>FluxCore</span></div>
        <nav className="sidebar-nav" aria-label="主导航">
          <button className="nav-item active" type="button"><Boxes size={17} aria-hidden="true" />项目</button>
          <button className="nav-item" type="button" disabled><Activity size={17} aria-hidden="true" />活动流</button>
        </nav>
        <div className="sidebar-footer">
          <span><span className="connection-dot" />{authMode === "demo" ? "演示数据" : "本机服务已连接"}</span>
          <button className="text-button" type="button" onClick={signOut}><LogOut size={12} aria-hidden="true" />{authMode === "demo" ? "退出演示" : "退出 token"}</button>
        </div>
      </aside>

      <main className="content-shell">
        <header className="page-header">
          <div>
            <p className="eyebrow">WORKSPACE</p>
            <h1>项目</h1>
            <p className="page-subtitle">从 Git 活动开始，集中查看每个开发流的当前上下文。</p>
          </div>
          <button className="primary-button compact" type="button" onClick={() => setShowCreate(true)}>
            <Plus size={16} aria-hidden="true" /> 新建项目
          </button>
        </header>

        {authMode === "demo" && (
          <div className="demo-banner" role="status">
            <span>Demo 工作区 · 全部为演示数据，修改仅保留在当前标签页会话。</span>
            <button className="text-button" type="button" onClick={signOut}>退出 Demo</button>
          </div>
        )}

        {error && (
          <div className="error-banner" role="alert">
            <span>{error}</span>
            <button className="icon-button" type="button" aria-label="关闭错误提示" title="关闭" onClick={() => setError(null)}><X size={17} aria-hidden="true" /></button>
          </div>
        )}

        <section className="project-section" aria-labelledby="project-list-title">
          <div className="section-heading">
            <h2 id="project-list-title">全部项目</h2>
            <button className="quiet-button" type="button" onClick={() => void loadProjects()} disabled={loading}>
              <RefreshCw size={14} className={loading ? "spin" : ""} aria-hidden="true" /> {loading ? "同步中" : "刷新"}
            </button>
          </div>
          {loading && projects.length === 0 ? <LoadingState /> : projects.length === 0 ? <EmptyState onCreate={() => setShowCreate(true)} /> : (
            <div className="project-grid">
              {projects.map((project) => <ProjectCard key={project.id} project={project} />)}
            </div>
          )}
        </section>
      </main>

      {showCreate && (
        <CreateProjectDialog
          token={token}
          demoMode={authMode === "demo"}
          onClose={() => setShowCreate(false)}
          onCreated={(project) => {
            setProjects((current) => [...current, project].sort((a, b) => a.id - b.id));
            setShowCreate(false);
          }}
        />
      )}
    </div>
  );
}

function ProjectCard({ project }: { project: Project }) {
  return (
    <article className="project-card">
      <div className="project-card-top">
        <div className="project-icon">{project.name.slice(0, 1).toUpperCase()}</div>
        <span className="status-pill"><span className="status-dot" />运行中</span>
      </div>
      <h3>{project.name}</h3>
      <p className="project-description">{project.description || "还没有项目描述"}</p>
      <div className="project-meta">
        <span><strong>{project.repository_count}</strong> 个仓库</span>
        <span className="project-id">#{project.id}</span>
      </div>
    </article>
  );
}

function LoadingState() {
  return <div className="loading-grid" aria-label="正在加载项目"><div /><div /><div /></div>;
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="empty-state">
      <div className="empty-icon"><FolderGit2 size={36} aria-hidden="true" /></div>
      <h3>还没有项目</h3>
      <p>先创建一个项目，再通过现有 CLI 绑定本地仓库。</p>
      <button className="secondary-button" type="button" onClick={onCreate}>创建第一个项目</button>
    </div>
  );
}

function CreateProjectDialog({ token, demoMode, onClose, onCreated }: { token: string; demoMode: boolean; onClose: () => void; onCreated: (project: Project) => void }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const input = { name: name.trim(), description: description.trim() };
      if (demoMode) {
        onCreated(createDemoProject(input));
      } else {
        const response = await createProject(token, input);
        onCreated({ ...response.project, repository_count: 0 });
      }
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "项目创建失败");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="modal" role="dialog" aria-modal="true" aria-labelledby="create-project-title">
        <div className="modal-heading"><div><p className="eyebrow">NEW PROJECT</p><h2 id="create-project-title">创建项目</h2></div><button className="icon-button" type="button" aria-label="关闭" title="关闭" onClick={onClose}><X size={18} aria-hidden="true" /></button></div>
        <form onSubmit={submit}>
          <label htmlFor="project-name">项目名称</label>
          <input id="project-name" value={name} onChange={(event) => setName(event.target.value)} maxLength={120} autoFocus placeholder="例如：FluxCore" />
          <label htmlFor="project-description">描述 <span>可选</span></label>
          <textarea id="project-description" value={description} onChange={(event) => setDescription(event.target.value)} maxLength={500} rows={3} placeholder="一句话说明这个项目" />
          {error && <p className="form-error">{error}</p>}
          <div className="modal-actions"><button className="quiet-button" type="button" onClick={onClose}>取消</button><button className="primary-button" type="submit" disabled={saving || !name.trim()}>{saving ? "创建中…" : <><Plus size={15} aria-hidden="true" />创建项目</>}</button></div>
        </form>
      </section>
    </div>
  );
}

export default App;
