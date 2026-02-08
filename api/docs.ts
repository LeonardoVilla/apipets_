import type { VercelRequest, VercelResponse } from "@vercel/node";
import { methodNotAllowed } from "./_lib/http";

const HTML = "<!doctype html>\n" +
"<html lang=\"pt-BR\">\n" +
"  <head>\n" +
"    <meta charset=\"UTF-8\" />\n" +
"    <meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\" />\n" +
"    <title>Swagger UI</title>\n" +
"    <link rel=\"stylesheet\" href=\"https://unpkg.com/swagger-ui-dist@5/swagger-ui.css\" />\n" +
"  </head>\n" +
"  <body>\n" +
"    <div id=\"swagger\"></div>\n" +
"    <script src=\"https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js\"></script>\n" +
"    <script>\n" +
"      window.ui = SwaggerUIBundle({\n" +
"        url: '/openapi',\n" +
"        dom_id: '#swagger',\n" +
"      });\n" +
"    </script>\n" +
"  </body>\n" +
"</html>\n";

export default function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    methodNotAllowed(res, ["GET"]);
    return;
  }

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.status(200).send(HTML);
}
