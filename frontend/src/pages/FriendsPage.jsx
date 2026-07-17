import { useCallback, useEffect, useState } from "react";
import { api } from "../api.js";
import BottomNav from "../components/BottomNav.jsx";
import ConfirmDialog from "../components/ConfirmDialog.jsx";
import { ensureCurrentUser } from "../userSession.js";

const FRIENDS_POLL_INTERVAL_MS = 10000;

function Avatar({ user }) {
  const initials = user.name.trim().slice(0, 2).toUpperCase();
  return (
    <div className="friend-avatar">
      {user.photo_url ? <img src={user.photo_url} alt="" /> : initials}
    </div>
  );
}

export default function FriendsPage() {
  const [user, setUser] = useState(null);
  const [friends, setFriends] = useState([]);
  const [locations, setLocations] = useState([]);
  const [friendCode, setFriendCode] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [confirmation, setConfirmation] = useState(null);

  const loadData = useCallback(async (profile, quiet = false) => {
    const [connections, liveLocations] = await Promise.allSettled([
      api.getFriends(profile.id),
      api.getFriendLocations(profile.id),
    ]);
    if (connections.status === "fulfilled") setFriends(connections.value);
    if (liveLocations.status === "fulfilled") setLocations(liveLocations.value);
    if (!quiet) {
      const failure = [connections, liveLocations].find((result) => result.status === "rejected");
      setError(failure ? failure.reason?.message || "Не вдалося оновити дані друзів" : "");
    }
  }, []);

  useEffect(() => {
    let active = true;
    let intervalId;

    ensureCurrentUser()
      .then(async (profile) => {
        if (!active) return;
        setUser(profile);
        await loadData(profile);
        intervalId = window.setInterval(() => {
          if (document.visibilityState === "visible") loadData(profile, true);
        }, FRIENDS_POLL_INTERVAL_MS);
      })
      .catch((err) => active && setError(err.message));

    return () => {
      active = false;
      if (intervalId) window.clearInterval(intervalId);
    };
  }, [loadData]);

  async function addFriend(event) {
    event.preventDefault();
    if (!user || sending) return;

    const code = friendCode.trim().toUpperCase();
    setError("");
    setMessage("");
    setSending(true);

    try {
      await api.sendFriendRequest(user.id, code);
      setFriendCode("");
      setMessage("Запит у друзі відправлено. На іншому пристрої він з’явиться автоматично.");
      await loadData(user);
    } catch (err) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  }

  async function accept(friendshipId) {
    if (!user) return;
    setError("");
    try {
      await api.acceptFriendRequest(user.id, friendshipId);
      setMessage("Запит прийнято");
      await loadData(user);
    } catch (err) {
      setError(err.message);
    }
  }

  function removeFriend(friend, actionLabel = "Видалити") {
    if (!user || deletingId) return;
    const targetLabel = friend.status === "accepted" ? "друга" : "запит";
    setConfirmation({
      friend,
      actionLabel,
      title: `${actionLabel} ${targetLabel}?`,
      message: `${actionLabel} ${targetLabel} із ${friend.name}?`,
    });
  }

  async function confirmRemoveFriend() {
    if (!confirmation || !user || deletingId) return;
    const { friend } = confirmation;
    setConfirmation(null);
    setError("");
    setMessage("");
    setDeletingId(friend.friendship_id);
    try {
      await api.deleteFriend(user.id, friend.friendship_id);
      setMessage(`Дію для ${friend.name} виконано`);
      await loadData(user);
    } catch (err) {
      setError(err.message);
    } finally {
      setDeletingId(null);
    }
  }

  const liveByUserId = new Map(locations.map((location) => [location.user_id, location]));
  const accepted = friends.filter((friend) => friend.status === "accepted");
  const incoming = friends.filter(
    (friend) => friend.status === "pending" && friend.direction === "incoming"
  );
  const outgoing = friends.filter(
    (friend) => friend.status === "pending" && friend.direction === "outgoing"
  );

  return (
    <main className="main-tab-page">
      <div className="tab-page__content">
        <div className="eyebrow">Команда</div>
        <h1>Друзі</h1>
        <p className="muted">
          Додавайте людей за публічним кодом друга.
        </p>

        <form className="friend-add-form" onSubmit={addFriend}>
          <input
            value={friendCode}
            onChange={(event) => setFriendCode(event.target.value.toUpperCase())}
            placeholder="Код друга, напр. A8J4K2QZ"
            minLength="8"
            maxLength="8"
            required
          />
          <button className="button primary" type="submit" disabled={sending}>
            {sending ? "Надсилання..." : "Додати"}
          </button>
        </form>

        {incoming.length > 0 && (
          <section className="friend-section">
            <h2>Вхідні запити</h2>
            <div className="friend-list">
              {incoming.map((friend) => (
                <article className="friend-row" key={friend.friendship_id}>
                  <Avatar user={friend} />
                  <div className="friend-row__main">
                    <strong>{friend.name}</strong>
                    <span>Хоче додати вас у друзі</span>
                  </div>
                  <div className="friend-row__actions">
                    <button className="small-action" type="button" onClick={() => accept(friend.friendship_id)}>Прийняти</button>
                    <button className="small-action small-action--danger" type="button" onClick={() => removeFriend(friend, "Відхилити")}>Відхилити</button>
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}

        <section className="friend-section">
          <h2>Мої друзі</h2>
          {accepted.length === 0 ? (
            <div className="empty-state compact">
              <div className="empty-state__icon">◎</div>
              <h2>Поки немає друзів</h2>
              <p>Обміняйтеся кодами і прийміть запит.</p>
            </div>
          ) : (
            <div className="friend-list">
              {accepted.map((friend) => {
                const live = liveByUserId.get(friend.user_id);
                return (
                  <article className="friend-row" key={friend.friendship_id}>
                    <Avatar user={friend} />
                    <div className="friend-row__main">
                      <strong>{friend.name}</strong>
                      <span>
                        {live
                          ? live.presence === "online"
                            ? "На карті зараз"
                            : `Оновлено ${live.age_seconds} с тому`
                          : "Геолокація недоступна"}
                      </span>
                    </div>
                    <span className={`presence-dot ${live?.presence || "hidden"}`} />
                    <button
                      className="small-action small-action--danger"
                      type="button"
                      onClick={() => removeFriend(friend)}
                      disabled={deletingId === friend.friendship_id}
                    >
                      {deletingId === friend.friendship_id ? "..." : "Видалити"}
                    </button>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        {outgoing.length > 0 && (
          <section className="friend-section muted-section">
            <h2>Очікують відповіді</h2>
            <div className="friend-list">
              {outgoing.map((friend) => (
                <article className="friend-row" key={friend.friendship_id}>
                  <Avatar user={friend} />
                  <div className="friend-row__main"><strong>{friend.name}</strong><span>Запит очікує відповіді</span></div>
                  <button className="small-action small-action--danger" type="button" onClick={() => removeFriend(friend, "Скасувати")}>Скасувати</button>
                </article>
              ))}
            </div>
          </section>
        )}

        {message && <p className="success-message">{message}</p>}
        {error && <p className="error">{error}</p>}
      </div>
      <ConfirmDialog
        open={Boolean(confirmation)}
        title={confirmation?.title}
        message={confirmation?.message}
        confirmLabel={confirmation?.actionLabel}
        onCancel={() => setConfirmation(null)}
        onConfirm={confirmRemoveFriend}
      />
      <BottomNav />
    </main>
  );
}
