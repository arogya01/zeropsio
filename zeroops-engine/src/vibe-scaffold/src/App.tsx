import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";

// Vite sets import.meta.env.BASE_URL from --base (preview proxy path or "/").
// Without basename, routes never match under /api/vibe/preview/<id>/ → blank iframe.
const basename = (import.meta.env.BASE_URL || "/").replace(/\/$/, "") || "/";

const App = () => (
  <BrowserRouter basename={basename}>
    <Routes>
      <Route path="/" element={<Index />} />
      {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
      <Route
        path="*"
        element={
          <div className="min-h-screen flex items-center justify-center bg-background text-foreground">
            <div className="text-center space-y-2">
              <h1 className="text-2xl font-semibold">404</h1>
              <p className="text-muted-foreground">Page not found</p>
            </div>
          </div>
        }
      />
    </Routes>
  </BrowserRouter>
);

export default App;
