import { useLocation } from "react-router-dom";
import { useEffect } from "react";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <>
      {/* Safe area background - prevents content from showing under status bar */}
      <div 
        className="fixed top-0 left-0 right-0 z-[60] bg-background"
        style={{ height: 'var(--safe-area-top, 0px)' }}
      />
      <div className="flex min-h-screen items-center justify-center bg-background pt-[var(--safe-area-top,0px)] pb-[var(--safe-area-bottom,0px)]">
        <div className="text-center">
          <h1 className="mb-4 text-4xl font-bold">404</h1>
          <p className="mb-4 text-xl text-muted-foreground">Oops! Page non trouvée</p>
          <a href="/" className="text-primary underline hover:text-primary/80">
            Retour à l'accueil
          </a>
        </div>
      </div>
    </>
  );
};

export default NotFound;
