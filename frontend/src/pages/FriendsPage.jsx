import { useCallback, useEffect, useState } from "react";
import { api } from "../api.js";
import AppIcon from "../components/AppIcon.jsx";
import BottomNav from "../components/BottomNav.jsx";
import ConfirmDialog from "../components/ConfirmDialog.jsx";
import { localizeApiMessage, useI18n } from "../i18n.js";
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
  const { language, tr } = useI18n();
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
      setError(failure ? localizeApiMessage(failure.reason?.message, language) || tr("Не вдалося оновити дані друзів", "Could not update friends") : "");
    }
  }, [language, tr]);

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
      .catch((err) => active && setError(localizeApiMessage(err.message, language)));

    return () => {
      active = false;
      if (intervalId) window.clearInterval(intervalId);
    };
  }, [language, loadData]);

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
      setMessage(tr("Запит у друзі відправлено. На іншому пристрої він з’явиться автоматично.", "Friend request sent. It will appear automatically on the other device."));
      await loadData(user);
    } catch (err) {
      setError(localizeApiMessage(err.message, language));
    } finally {
      setSending(false);
    }
  }

  async function accept(friendshipId) {
    if (!user) return;
    setError("");
    try {
      await api.acceptFriendRequest(user.id, friendshipId);
      setMessage(tr("Запит прийнято", "Request accepted"));
      await loadData(user);
    } catch (err) {
      setError(localizeApiMessage(err.message, language));
    }
  }

  function removeFriend(friend, actionLabel = tr("Видалити", "Remove")) {
    if (!user || deletingId) return;
    const isAcceptedFriend = friend.status === "accepted";
    const targetLabel = isAcceptedFriend ? tr("друга", "friend") : tr("запит", "request");
    setConfirmation({
      friend,
      actionLabel,
      title: `${actionLabel} ${targetLabel}?`,
      message: isAcceptedFriend
        ? tr(`Видалити ${friend.name} із друзів?`, `Remove ${friend.name} from friends?`)
        : tr(`${actionLabel} запит від ${friend.name}?`, `${actionLabel} request from ${friend.name}?`),
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
      setMessage(tr(`Дію для ${friend.name} виконано`, `Action completed for ${friend.name}`));
      await loadData(user);
    } catch (err) {
      setError(localizeApiMessage(err.message, language));
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
        <div className="eyebrow">{tr("Команда", "Community")}</div>
        <h1>{tr("Друзі", "Friends")}</h1>
        <p className="muted">
          {tr("Додавайте людей за публічним кодом друга.", "Add people using their public friend code.")}
        </p>

        <form className="friend-add-form" onSubmit={addFriend}>
          <input
            value={friendCode}
            onChange={(event) => setFriendCode(event.target.value.toUpperCase())}
            placeholder={tr("Код друга, напр. A8J4K2QZ", "Friend code, e.g. A8J4K2QZ")}
            minLength="8"
            maxLength="8"
            required
          />
          <button className="button primary" type="submit" disabled={sending}>
            {sending ? tr("Надсилання...", "Sending...") : tr("Додати", "Add")}
          </button>
        </form>

        {incoming.length > 0 && (
          <section className="friend-section">
            <h2>{tr("Вхідні запити", "Incoming requests")}</h2>
            <div className="friend-list">
              {incoming.map((friend) => (
                <article className="friend-row" key={friend.friendship_id}>
                  <Avatar user={friend} />
                  <div className="friend-row__main">
                    <strong>{friend.name}</strong>
                    <span>{tr("Хоче додати вас у друзі", "Wants to add you as a friend")}</span>
                  </div>
                  <div className="friend-row__actions">
                    <button className="small-action" type="button" onClick={() => accept(friend.friendship_id)}>{tr("Прийняти", "Accept")}</button>
                    <button className="small-action small-action--danger" type="button" onClick={() => removeFriend(friend, tr("Відхилити", "Decline"))}>{tr("Відхилити", "Decline")}</button>
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}

        <section className="friend-section">
          <h2>{tr("Мої друзі", "My friends")}</h2>
          {accepted.length === 0 ? (
            <div className="empty-state compact">
              <div className="empty-state__icon"><AppIcon name="friends" /></div>
              <h2>{tr("Поки немає друзів", "No friends yet")}</h2>
              <p>{tr("Обміняйтеся кодами і прийміть запит.", "Exchange codes and accept a request.")}</p>
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
                            ? tr("На карті зараз", "On the map now")
                            : tr(`Оновлено ${live.age_seconds} с тому`, `Updated ${live.age_seconds}s ago`)
                          : tr("Геолокація недоступна", "Location unavailable")}
                      </span>
                    </div>
                    <span className={`presence-dot ${live?.presence || "hidden"}`} />
                    <button
                      className="small-action small-action--danger"
                      type="button"
                      onClick={() => removeFriend(friend)}
                      disabled={deletingId === friend.friendship_id}
                    >
                      {deletingId === friend.friendship_id ? "..." : tr("Видалити", "Remove")}
                    </button>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        {outgoing.length > 0 && (
          <section className="friend-section muted-section">
            <h2>{tr("Очікують відповіді", "Awaiting response")}</h2>
            <div className="friend-list">
              {outgoing.map((friend) => (
                <article className="friend-row" key={friend.friendship_id}>
                  <Avatar user={friend} />
                  <div className="friend-row__main"><strong>{friend.name}</strong><span>{tr("Запит очікує відповіді", "Request is awaiting a response")}</span></div>
                  <button className="small-action small-action--danger" type="button" onClick={() => removeFriend(friend, tr("Скасувати", "Cancel"))}>{tr("Скасувати", "Cancel")}</button>
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
