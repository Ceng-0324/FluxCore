import { FormEvent, useCallback, useEffect, useState } from "react";
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

const TOKEN_STORAGE_KEY = "fluxcore.api_token";

function readStoredToken(): string {
  return sessionStorage.getItem(TOKEN_STORAGE_KEY) || "";
}

function App() {
  const [token, setToken] = useState(readStoredToken);
  const [tokenDraft, setTokenDraft] = useState(readStoredToken);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const loadProjects = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const response = await listProjects(token);
      setProjects(response.projects);
    } catch (requestError) {
      if (requestError instanceof APIError && requestError.status === 401) {
        sessionStorage.removeItem(TOKEN_STORAGE_KEY);
        setToken("");
        setTokenDraft("");
        setError("API token 无效或已失效，请重新输入。");
      } else {
        setError(requestError instanceof Error ? requestError.message : "项目加载失败");
      }
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void loadProjects();
  }, [loadProjects]);

  function saveToken(event: FormEvent) {
    event.preventDefault();
    const nextToken = tokenDraft.trim();
    if (!nextToken) return;
    sessionStorage.setItem(TOKEN_STORAGE_KEY, nextToken);
    setError(null);
    setToken(nextToken);
  }

  function signOut() {
    sessionStorage.removeItem(TOKEN_STORAGE_KEY);
    setToken("");
    setTokenDraft("");
    setProjects([]);
  }

  if (!token) {
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
          {error && <p className="form-error">{error}</p>}
          <p className="auth-footnote">token 仅保存在当前浏览器会话中。</p>
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
          <span className="connection-dot" />本机服务已连接
          <button className="text-button" type="button" onClick={signOut}><LogOut size={12} aria-hidden="true" />退出 token</button>
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

function CreateProjectDialog({ token, onClose, onCreated }: { token: string; onClose: () => void; onCreated: (project: Project) => void }) {
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
      const response = await createProject(token, { name: name.trim(), description: description.trim() });
      onCreated({ ...response.project, repository_count: 0 });
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
