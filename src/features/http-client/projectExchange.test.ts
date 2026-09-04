import { describe, expect, it } from "vitest";
import { exportOpenApi, importCollection } from "./projectExchange";

describe("HTTP project exchange", () => {
  it("imports OpenAPI paths and server URL", () => {
    const project = importCollection({ openapi: "3.0.3", info: { title: "Users" }, servers: [{ url: "https://api.example.com" }], paths: { "/users": { get: { summary: "用户列表", tags: ["用户"] } } } });
    expect(project?.name).toBe("Users");
    expect(project?.interfaces?.[0].method).toBe("GET");
    expect(project?.interfaces?.[0].path).toBe("/users");
    expect(project?.environments?.[0].baseUrl).toBe("https://api.example.com");
  });

  it("imports nested Postman folders", () => {
    const project = importCollection({ info: { name: "Demo", schema: "https://schema.getpostman.com/json/collection/v2.1.0/collection.json" }, item: [{ name: "Auth", item: [{ name: "登录", request: { method: "POST", url: "https://api.example.com/login" } }] }] });
    expect(project?.interfaceFolders).toContain("Auth");
    expect(project?.interfaces?.[0].folder).toBe("Auth");
    expect(project?.interfaces?.[0].method).toBe("POST");
  });

  it("exports project paths as OpenAPI", () => {
    const document = exportOpenApi({ id: "p", name: "Demo", description: "", createdAt: "", interfaces: [{ id: "i", name: "健康检查", method: "GET", path: "/health", createdAt: "", folder: "默认模块" }], environment: [], environments: [], activeEnvironmentId: "", interfaceFolders: [] });
    expect(document.openapi).toBe("3.0.3");
    expect(document.paths["/health"].get.summary).toBe("健康检查");
  });
});
