import { useState } from "react";
import { Navigate, Route, Routes, useNavigate } from "react-router-dom";
import CreatePage from "./pages/CreatePage.jsx";
import EventsPage from "./pages/EventsPage.jsx";
import FriendsPage from "./pages/FriendsPage.jsx";
import JoinPage from "./pages/JoinPage.jsx";
import LoginPage from "./pages/LoginPage.jsx";
import MapPage from "./pages/MapPage.jsx";
import ProfilePage from "./pages/ProfilePage.jsx";
import RoomPage from "./pages/RoomPage.jsx";

function hasStoredUser() {
  const storedId = Number(localStorage.getItem("outdoor_user_id"));
  return Number.isInteger(storedId) && storedId > 0;
}

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(() => hasStoredUser());
  const navigate = useNavigate();

  function handleAuthenticated(user) {
    if (user) {
      setIsAuthenticated(true);
      navigate("/map", { replace: true });
    }
  }

  return (
    <Routes>
      <Route path="/login" element={<LoginPage onAuthenticated={handleAuthenticated} />} />
      <Route path="/" element={isAuthenticated ? <Navigate to="/map" replace /> : <Navigate to="/login" replace />} />
      <Route path="/map" element={isAuthenticated ? <MapPage /> : <Navigate to="/login" replace />} />
      <Route path="/friends" element={isAuthenticated ? <FriendsPage /> : <Navigate to="/login" replace />} />
      <Route path="/events" element={isAuthenticated ? <EventsPage /> : <Navigate to="/login" replace />} />
      <Route path="/profile" element={isAuthenticated ? <ProfilePage /> : <Navigate to="/login" replace />} />
      <Route path="/create" element={isAuthenticated ? <CreatePage /> : <Navigate to="/login" replace />} />
      <Route path="/join" element={isAuthenticated ? <JoinPage /> : <Navigate to="/login" replace />} />
      <Route path="/room/:code" element={isAuthenticated ? <RoomPage /> : <Navigate to="/login" replace />} />
    </Routes>
  );
}
