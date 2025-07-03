import fs from "fs";
import path from "path";

export const renderHtmlTemplate = (templateName, variables) => {
  const templatePath = path.join(
    process.cwd(),
    "src",
    "templates",
    templateName
  );
  let html = fs.readFileSync(templatePath, "utf-8");

  for (const key in variables) {
    const pattern = new RegExp(`{{\\s*${key}\\s*}}`, "g");
    html = html.replace(pattern, variables[key]);
  }

  return html;
};
