import { expect, Page, test } from "@playwright/test";

type Project = {
  id: number;
  name: string;
  description: string;
  status: "active";
  repository_count: number;
  created_at: string;
  updated_at: string;
};

const now = "2026-09-19T12:00:00Z";

async function prepareProjectAPI(page: Page) {
  const projects: Project[] = [
    {
      id: 1,
      name: "FluxCore",
      description: "Git 原生研发状态记录系统",
      status: "active",
      repository_count: 2,
      created_at: now,
      updated_at: now,
    },
  ];

  await page.addInitScript(() => {
    sessionStorage.setItem("fluxcore.api_token", "test-token");
  });
  await page.route("**/api/projects", async (route) => {
    if (route.request().method() === "POST") {
      const body = route.request().postDataJSON() as { name: string; description: string };
      const project = {
        id: projects.length + 1,
        name: body.name,
        description: body.description,
        status: "active" as const,
        created_at: now,
        updated_at: now,
      };
      projects.push({ ...project, repository_count: 0 });
      await route.fulfill({ status: 201, json: { project } });
      return;
    }

    await route.fulfill({ status: 200, json: { projects } });
  });
}

test("requires a runtime API token", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "连接你的 FluxCore" })).toBeVisible();
  await expect(page.getByLabel("API token")).toHaveAttribute("type", "password");
  await expect(page.getByText("token 仅保存在当前浏览器会话中。")).toBeVisible();
});

test("enters the isolated demo workspace without API requests", async ({ page }) => {
  const apiRequests: string[] = [];
  page.on("request", (request) => {
    if (["fetch", "xhr"].includes(request.resourceType())) apiRequests.push(request.url());
  });

  await page.goto("/");
  await page.getByRole("button", { name: "进入演示" }).click();

  await expect(page.getByRole("heading", { name: "Atlas Notes" })).toBeVisible();
  await expect(page.getByText("演示数据", { exact: true })).toBeVisible();
  expect(apiRequests).toHaveLength(0);

  await page.getByRole("button", { name: "新建项目" }).click();
  await page.getByLabel("项目名称").fill("Demo Archive");
  await page.getByLabel("描述 可选").fill("只存在于浏览器会话中的项目");
  await page.getByRole("dialog").getByRole("button", { name: "创建项目" }).click();

  await expect(page.getByRole("heading", { name: "Demo Archive" })).toBeVisible();
  await page.getByRole("button", { name: "刷新" }).click();
  await expect(page.getByRole("heading", { name: "Demo Archive" })).toBeVisible();
  expect(apiRequests).toHaveLength(0);

  await page.reload();
  await expect(page.getByRole("heading", { name: "Demo Archive" })).toBeVisible();
  expect(apiRequests).toHaveLength(0);
});

test("validates demo credentials and isolates logout from token login", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Demo 密码").fill("wrong-password");
  await page.getByRole("button", { name: "进入演示" }).click();
  await expect(page.getByRole("alert")).toHaveText("Demo 账号或密码不正确。");
  await page.getByLabel("Demo 密码").fill("fluxcore-demo");
  await page.getByRole("button", { name: "进入演示" }).click();
  await expect(page.getByRole("heading", { name: "Atlas Notes" })).toBeVisible();
  await page.getByRole("button", { name: "退出 Demo", exact: true }).click();
  await page.reload();
  await expect(page.getByLabel("API token")).toBeVisible();
  expect(await page.evaluate(() => sessionStorage.getItem("fluxcore.demo_session"))).toBeNull();

  await page.route("**/api/projects", async (route) => {
    expect(route.request().headers().authorization).toBe("Bearer real-test-token");
    await route.fulfill({ json: { projects: [] } });
  });
  await page.getByLabel("API token").fill("real-test-token");
  await page.getByRole("button", { name: "进入控制台" }).click();
  await expect(page.getByRole("heading", { name: "还没有项目" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Atlas Notes" })).toHaveCount(0);
  await page.getByRole("button", { name: "退出 token" }).click();
  await page.getByRole("button", { name: "进入演示" }).click();
  await expect(page.getByRole("heading", { name: "Atlas Notes" })).toBeVisible();
  expect(await page.evaluate(() => sessionStorage.getItem("fluxcore.api_token"))).toBeNull();
});

test("lists and creates projects", async ({ page }) => {
  await prepareProjectAPI(page);
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "FluxCore" })).toBeVisible();
  await expect(page.getByText("2 个仓库")).toBeVisible();

  await page.getByRole("button", { name: "新建项目" }).click();
  await page.getByLabel("项目名称").fill("Sidecar");
  await page.getByLabel("描述 可选").fill("本地开发辅助工具");
  await page.getByRole("dialog").getByRole("button", { name: "创建项目" }).click();

  await expect(page.getByRole("heading", { name: "Sidecar" })).toBeVisible();
  await expect(page.getByText("0 个仓库")).toBeVisible();
});

test.describe("mobile layout", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("keeps the project workspace within the viewport", async ({ page }) => {
    await prepareProjectAPI(page);
    await page.goto("/");

    await expect(page.getByRole("heading", { name: "项目", exact: true })).toBeVisible();
    const hasHorizontalOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    expect(hasHorizontalOverflow).toBe(false);
  });

  test("keeps demo mode visible and allows logout", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "进入演示" }).click();
    await expect(page.getByRole("status")).toContainText("全部为演示数据");
    await expect(page.getByRole("heading", { name: "Paper Trail" })).toBeVisible();
    expect(await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    )).toBe(false);
    await page.getByRole("button", { name: "退出 Demo", exact: true }).click();
    await expect(page.getByLabel("Demo 账号")).toBeVisible();
  });
});
