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
});
