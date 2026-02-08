export default function App() {
  return (
    <main className="page">
      <section className="card">
        <h1>Gerenciador de Pets</h1>
        <p>
          API com endpoints funcionais, Swagger e armazenamento de imagens em
          Vercel Blob.
        </p>
        <div className="links">
          <a href="/docs" target="_blank" rel="noreferrer">
            Abrir Swagger UI
          </a>
          <a href="/openapi" target="_blank" rel="noreferrer">
            Ver OpenAPI
          </a>
        </div>
      </section>
    </main>
  );
}
