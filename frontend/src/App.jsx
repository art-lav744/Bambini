import { lazy, Suspense, useEffect, useState } from "react";
import { Navigate, Route, Routes, useNavigate } from "react-router-dom";
import { api } from "./api.js";
import { applyCustomization, DEFAULT_CUSTOMIZATION } from "./customization.js";
import { ensureCurrentUser, hasStoredSession, subscribeToAuthChanges } from "./userSession.js";

const CreatePage = lazy(() => import("./pages/CreatePage.jsx"));
const EventsPage = lazy(() => import("./pages/EventsPage.jsx"));
const FriendsPage = lazy(() => import("./pages/FriendsPage.jsx"));
const JoinPage = lazy(() => import("./pages/JoinPage.jsx"));
const LoginPage = lazy(() => import("./pages/LoginPage.jsx"));
const MapPage = lazy(() => import("./pages/MapPage.jsx"));
const ProfilePage = lazy(() => import("./pages/ProfilePage.jsx"));
const RoomPage = lazy(() => import("./pages/RoomPage.jsx"));
const CustomizationPage = lazy(() => import("./pages/CustomizationPage.jsx"));
const NotFoundPage = lazy(() => import("./pages/NotFoundPage.jsx"));

function Protected({ authenticated, children }) {
  return authenticated ? children : <Navigate to="/login" replace />;
}

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(hasStoredSession);
  const navigate = useNavigate();

  useEffect(() => subscribeToAuthChanges(setIsAuthenticated), []);

  useEffect(() => {
    let active = true;
    if (!isAuthenticated) {
      applyCustomization(DEFAULT_CUSTOMIZATION);
      return undefined;
    }

    ensureCurrentUser()
      .then((user) => api.getCustomization(user.id))
      .then((customization) => {
        if (active) applyCustomization(customization);
      })
      .catch(() => {
        if (active) applyCustomization(DEFAULT_CUSTOMIZATION);
      });

    return () => {
      active = false;
    };
  }, [isAuthenticated]);

  function handleAuthenticated(user) {
    if (user) {
      setIsAuthenticated(true);
      navigate("/map", { replace: true });
    }
  }

  return (
    <Suspense fallback={<main className="loading-screen">Завантаження…</main>}>
      <Routes>
        <Route path="/login" element={isAuthenticated ? <Navigate to="/map" replace /> : <LoginPage onAuthenticated={handleAuthenticated} />} />
        <Route path="/" element={<Navigate to={isAuthenticated ? "/map" : "/login"} replace />} />
        <Route path="/map" element={<Protected authenticated={isAuthenticated}><MapPage /></Protected>} />
        <Route path="/friends" element={<Protected authenticated={isAuthenticated}><FriendsPage /></Protected>} />
        <Route path="/events" element={<Protected authenticated={isAuthenticated}><EventsPage /></Protected>} />
        <Route path="/profile" element={<Protected authenticated={isAuthenticated}><ProfilePage /></Protected>} />
        <Route path="/customization" element={<Protected authenticated={isAuthenticated}><CustomizationPage /></Protected>} />
        <Route path="/create" element={<Protected authenticated={isAuthenticated}><CreatePage /></Protected>} />
        <Route path="/join" element={<Protected authenticated={isAuthenticated}><JoinPage /></Protected>} />
        <Route path="/room/:code" element={<Protected authenticated={isAuthenticated}><RoomPage /></Protected>} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Suspense>
  );
}
