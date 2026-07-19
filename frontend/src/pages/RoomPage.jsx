import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "../api.js";
import AppIcon from "../components/AppIcon.jsx";
import BottomNav from "../components/BottomNav.jsx";
import ConfirmDialog from "../components/ConfirmDialog.jsx";
import EventLocationPicker from "../components/EventLocationPicker.jsx";
import EventTagPicker from "../components/EventTagPicker.jsx";
import { EVENT_PINS } from "../components/EventPinPreview.jsx";
import MapLibreMap from "../components/MapLibreMap.jsx";
import { ensureCurrentUser } from "../userSession.js";
import { eventDateTimeToLocal, formatEventDateTime, localDateTimeToUtc } from "../eventFormat.js";
import { eventTagLabel, normalizeEventTags } from "../eventTags.js";
import { localizeApiMessage, useI18n } from "../i18n.js";

const ROOM_REFRESH_MS = 10000;
const ROOM_LOCATION_UPLOAD_MS = 8000;

function locationVisibility(user) {
  return user?.location_visibility || (user?.location_sharing_enabled ? "friends" : "none");
}

function positionToLocation(position) {
  return {
    latitude: position.coords.latitude,
    longitude: position.coords.longitude,
    accuracy: position.coords.accuracy,
    updated_at: new Date().toISOString(),
  };
}

function eventEditorValues(activity) {
  return {
    title: activity.title || "",
    description: activity.description || "",
    tags: normalizeEventTags(activity.tags),
    visibility: activity.visibility || "public",
    image_url: activity.image_url || "",
    capacity: activity.capacity ?? null,
    pin_type: activity.pin_type || "default",
    start_time: eventDateTimeToLocal(activity.start_time),
    end_time: eventDateTimeToLocal(activity.end_time),
  };
}

function initials(name = "?") {
  return name.trim().slice(0, 2).toUpperCase() || "?";
}

export default function RoomPage() {
  const { language, tr } = useI18n();
  const { code } = useParams();
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [activity, setActivity] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [visibleLocations, setVisibleLocations] = useState([]);
  const [currentLocation, setCurrentLocation] = useState(null);
  const [error, setError] = useState("");
  const [panelOpen, setPanelOpen] = useState(true);
  const [leaving, setLeaving] = useState(false);
  const [joining, setJoining] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [removingUserId, setRemovingUserId] = useState(null);
  const [friendActionUserId, setFriendActionUserId] = useState(null);
  const [sheetView, setSheetView] = useState("details");
  const [editForm, setEditForm] = useState(null);
  const [editLocation, setEditLocation] = useState(null);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [confirmation, setConfirmation] = useState(null);
  const [panelDragOffset, setPanelDragOffset] = useState(0);
  const [panelDragging, setPanelDragging] = useState(false);
  const watchRef = useRef(null);
  const lastUploadAtRef = useRef(0);
  const panelDragRef = useRef(null);
  const ignorePanelClickRef = useRef(false);

  const loadRoom = useCallback(async () => {
    const [activityResult, participantsResult] = await Promise.allSettled([
      api.getActivity(code),
      api.getParticipants(code),
    ]);

    if (activityResult.status === "rejected") {
      if (activityResult.reason?.status === 404) {
        navigate("/events", { replace: true });
        return;
      }
      setError(localizeApiMessage(activityResult.reason?.message, language) || tr("Не вдалося завантажити подію", "Could not load the event"));
      return;
    }

    setActivity(activityResult.value);
    if (participantsResult.status === "fulfilled") {
      setParticipants(participantsResult.value);
      setError("");
    } else {
      setError(tr(
        `Подію завантажено, але список учасників не оновлено: ${participantsResult.reason?.message || "помилка сервера"}`,
        `The event loaded, but the participant list was not updated: ${localizeApiMessage(participantsResult.reason?.message, language) || "server error"}`,
      ));
    }
  }, [code, language, navigate, tr]);

  useEffect(() => {
    let active = true;
    ensureCurrentUser()
      .then((profile) => active && setUser(profile))
      .catch((err) => active && setError(localizeApiMessage(err.message, language)));
    loadRoom();
    const intervalId = window.setInterval(() => {
      if (document.visibilityState === "visible") loadRoom();
    }, ROOM_REFRESH_MS);
    return () => {
      active = false;
      window.clearInterval(intervalId);
    };
  }, [language, loadRoom]);

  useEffect(() => {
    if (!user?.id) return undefined;
    let active = true;
    const refresh = async () => {
      if (document.visibilityState !== "visible") return;
      try {
        const locations = await api.getVisibleLocations(user.id);
        if (active) setVisibleLocations(locations);
      } catch {
        // Room details remain usable if live locations temporarily fail.
      }
    };
    refresh();
    const id = window.setInterval(refresh, ROOM_REFRESH_MS);
    return () => {
      active = false;
      window.clearInterval(id);
    };
  }, [user]);

  const uploadLocation = useCallback(async (location, force = false) => {
    if (!user?.id || locationVisibility(user) === "none" || !location) return;
    const now = Date.now();
    if (!force && now - lastUploadAtRef.current < ROOM_LOCATION_UPLOAD_MS) return;
    lastUploadAtRef.current = now;
    try {
      await api.updateLocation(user.id, {
        latitude: location.latitude,
        longitude: location.longitude,
        accuracy: location.accuracy,
      });
    } catch {
      // Keep the local marker. The next GPS update retries synchronization.
    }
  }, [user]);

  const handleLocationFound = useCallback((location, force = false) => {
    setCurrentLocation(location);
    uploadLocation(location, force);
  }, [uploadLocation]);

  useEffect(() => {
    if (!user || !window.isSecureContext || !navigator.geolocation) return undefined;
    let disposed = false;

    const clearWatch = () => {
      if (watchRef.current !== null) navigator.geolocation.clearWatch(watchRef.current);
      watchRef.current = null;
    };
    const onPosition = (position, force = false) => {
      if (!disposed) handleLocationFound(positionToLocation(position), force);
    };
    const startWatch = () => {
      if (document.visibilityState !== "visible") return;
      navigator.geolocation.getCurrentPosition(
        (position) => onPosition(position, true),
        () => {},
        { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 }
      );
      if (watchRef.current === null) {
        watchRef.current = navigator.geolocation.watchPosition(
          (position) => onPosition(position),
          () => {},
          { enableHighAccuracy: true, maximumAge: 5000, timeout: 30000 }
        );
      }
    };
    const onVisibilityChange = () => {
      clearWatch();
      if (document.visibilityState === "visible") startWatch();
    };

    startWatch();
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      disposed = true;
      document.removeEventListener("visibilitychange", onVisibilityChange);
      clearWatch();
    };
  }, [handleLocationFound, user]);

  const isHost = Boolean(user && activity && activity.host_user_id === user.id);
  const isParticipant = Boolean(user && participants.some((participant) => participant.user_id === user.id));
  const directionsUrl = activity?.latitude != null && activity?.longitude != null
    ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${activity.latitude},${activity.longitude}`)}`
    : "";

  async function joinEvent() {
    if (!user || !activity || joining || isParticipant) return;
    setJoining(true);
    setError("");
    try {
      await api.joinActivity(activity.code, user.id);
      await loadRoom();
    } catch (err) {
      setError(localizeApiMessage(err.message, language));
    } finally {
      setJoining(false);
    }
  }

  function leaveEvent() {
    if (!user || !activity || isHost || !isParticipant || leaving) return;
    setConfirmation({
      title: tr("Вийти з події?", "Leave the event?"),
      message: tr(`Ви більше не будете учасником події «${activity.title}».`, `You will no longer be a participant of “${activity.title}”.`),
      confirmLabel: tr("Від’єднатися", "Leave"),
      action: performLeaveEvent,
    });
  }

  async function performLeaveEvent() {
    setLeaving(true);
    setError("");
    try {
      await api.leaveActivity(activity.code, user.id);
      navigate("/events", { replace: true });
    } catch (err) {
      setError(localizeApiMessage(err.message, language));
      setLeaving(false);
    }
  }

  function removeParticipant(participant) {
    if (!activity || !isHost || participant.is_host || removingUserId !== null) return;
    setConfirmation({
      title: tr("Видалити учасника?", "Remove participant?"),
      message: tr(`${participant.name} буде видалено зі списку учасників події.`, `${participant.name} will be removed from the event participant list.`),
      confirmLabel: tr("Видалити", "Remove"),
      action: () => performRemoveParticipant(participant),
    });
  }

  async function performRemoveParticipant(participant) {
    setRemovingUserId(participant.user_id);
    setError("");
    try {
      await api.removeActivityMember(activity.code, participant.user_id);
      await loadRoom();
    } catch (err) {
      setError(localizeApiMessage(err.message, language));
    } finally {
      setRemovingUserId(null);
    }
  }

  async function updateFriendship(participant) {
    if (!user || participant.user_id === user.id || friendActionUserId !== null) return;
    const canAccept = participant.friendship_status === "pending" && participant.friendship_direction === "incoming";
    if (!canAccept && (!participant.friend_code || participant.friendship_status)) return;
    setFriendActionUserId(participant.user_id);
    setError("");
    try {
      const friendship = canAccept
        ? await api.acceptFriendRequest(user.id, participant.friendship_id)
        : await api.sendFriendRequest(user.id, participant.friend_code);
      setParticipants((current) => current.map((item) => item.user_id === participant.user_id
        ? {
            ...item,
            friendship_id: friendship.friendship_id,
            friendship_status: friendship.status,
            friendship_direction: canAccept ? "incoming" : "outgoing",
          }
        : item));
      setNotice(canAccept
        ? tr(`${participant.name} тепер у друзях`, `${participant.name} is now your friend`)
        : tr(`Запит для ${participant.name} надіслано`, `Request sent to ${participant.name}`));
    } catch (err) {
      setError(localizeApiMessage(err.message, language));
    } finally {
      setFriendActionUserId(null);
    }
  }

  function openEditor() {
    if (!activity || !isHost) return;
    setEditForm(eventEditorValues(activity));
    setEditLocation(activity.latitude != null && activity.longitude != null
      ? { latitude: activity.latitude, longitude: activity.longitude }
      : null);
    setSheetView("edit");
    setPanelOpen(true);
    setNotice("");
    setError("");
  }

  function updateEditField(event) {
    const { name, value } = event.target;
    setEditForm((current) => ({ ...current, [name]: value }));
  }

  function setEditCapacity(value) {
    const numeric = Number(value);
    setEditForm((current) => ({
      ...current,
      capacity: Number.isFinite(numeric) && numeric > 0 ? numeric : null,
    }));
  }

  function handleEditImage(file) {
    if (!file) return;
    if (!file.type.startsWith("image/") || file.size > 2 * 1024 * 1024) {
      setError(tr("Оберіть зображення розміром до 2 МБ.", "Choose an image up to 2 MB."));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setEditForm((current) => ({ ...current, image_url: String(reader.result || "") }));
    reader.onerror = () => setError(tr("Не вдалося прочитати зображення.", "Could not read the image."));
    reader.readAsDataURL(file);
  }

  async function saveEvent(event) {
    event.preventDefault();
    if (!activity || !isHost || !editForm || !editLocation || saving) return;
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const payload = {
        title: editForm.title,
        description: editForm.description,
        tags: editForm.tags,
        visibility: editForm.visibility,
        capacity: editForm.capacity,
        pin_type: editForm.pin_type,
        start_time: localDateTimeToUtc(editForm.start_time),
        end_time: editForm.end_time ? localDateTimeToUtc(editForm.end_time) : null,
        latitude: editLocation.latitude,
        longitude: editLocation.longitude,
      };
      if (editForm.image_url !== activity.image_url) payload.image_url = editForm.image_url;
      const updated = await api.updateActivity(activity.code, payload);
      setActivity(updated);
      setEditForm(null);
      setSheetView("details");
      setNotice(tr("Зміни збережено. Учасники отримали повідомлення.", "Changes saved. Participants have been notified."));
    } catch (err) {
      setError(localizeApiMessage(err.message, language));
    } finally {
      setSaving(false);
    }
  }

  function deleteEvent() {
    if (!activity || !isHost || deleting) return;
    setConfirmation({
      title: tr("Видалити подію?", "Delete event?"),
      message: tr(`Подію «${activity.title}» буде видалено назавжди. Учасники отримають повідомлення.`, `The event “${activity.title}” will be deleted permanently. Participants will be notified.`),
      confirmLabel: tr("Видалити подію", "Delete event"),
      action: performDeleteEvent,
    });
  }

  async function performDeleteEvent() {
    setDeleting(true);
    setError("");
    try {
      await api.deleteActivity(activity.code);
      navigate("/events", { replace: true });
    } catch (err) {
      setError(localizeApiMessage(err.message, language));
      setDeleting(false);
    }
  }

  function handlePanelPointerDown(event) {
    panelDragRef.current = {
      pointerId: event.pointerId,
      startY: event.clientY,
      startOpen: panelOpen,
    };
    setPanelDragging(true);
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // Pointer capture is optional in older mobile webviews.
    }
  }

  function confirmPendingAction() {
    const action = confirmation?.action;
    setConfirmation(null);
    action?.();
  }

  function handlePanelPointerMove(event) {
    const drag = panelDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const distance = event.clientY - drag.startY;
    setPanelDragOffset(drag.startOpen ? Math.max(0, distance) : Math.min(0, distance));
  }

  function handlePanelPointerUp(event) {
    const drag = panelDragRef.current;
    panelDragRef.current = null;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const distance = event.clientY - drag.startY;
    setPanelDragOffset(0);
    setPanelDragging(false);
    if (Math.abs(distance) < 8) return;
    ignorePanelClickRef.current = true;
    window.setTimeout(() => { ignorePanelClickRef.current = false; }, 0);
    if (drag.startOpen && distance > 48) setPanelOpen(false);
    if (!drag.startOpen && distance < -48) setPanelOpen(true);
  }

  function cancelPanelDrag() {
    panelDragRef.current = null;
    setPanelDragOffset(0);
    setPanelDragging(false);
  }

  function handlePanelHandleClick() {
    if (ignorePanelClickRef.current) {
      ignorePanelClickRef.current = false;
      return;
    }
    setPanelOpen((value) => !value);
  }

  if (error && !activity) {
    return (
      <main className="form-page">
        <p className="error">{error}</p>
        <Link className="button secondary" to="/events">{tr("До подій", "Go to events")}</Link>
      </main>
    );
  }
  if (!activity) return <main className="loading-screen">{tr("Завантаження...", "Loading...")}</main>;

  return (
    <main className="room-map-page">
      <MapLibreMap
        eventPins={[activity]}
        currentUser={user}
        currentLocation={currentLocation}
        friendLocations={visibleLocations}
        enableLocation
        onLocationFound={handleLocationFound}
      />

      <div className="room-map-header">
        <Link to="/map" className="room-map-header__back" aria-label={tr("Повернутися на карту", "Return to map")}><AppIcon name="arrow-left" /></Link>
        <div className="room-map-header__title"><strong>{activity.title}</strong><span>{tr("Код:", "Code:")} {activity.code}</span></div>
      </div>

      <aside
        className={`room-sheet event-room-sheet${panelOpen ? "" : " is-collapsed"}${panelDragging ? " is-dragging" : ""}`}
        style={{ "--room-sheet-drag-y": `${panelDragOffset}px` }}
      >
        <button
          className="room-sheet__handle"
          type="button"
          aria-label={panelOpen ? tr("Згорнути інформацію про подію", "Collapse event information") : tr("Розгорнути інформацію про подію", "Expand event information")}
          aria-expanded={panelOpen}
          onClick={handlePanelHandleClick}
          onPointerDown={handlePanelPointerDown}
          onPointerMove={handlePanelPointerMove}
          onPointerUp={handlePanelPointerUp}
          onPointerCancel={cancelPanelDrag}
        />
        <div className="event-room-sheet__content" aria-hidden={!panelOpen}>
          <nav className="event-room-tabs" aria-label={tr("Деталі події", "Event details")}>
            <button type="button" className={sheetView === "details" ? "is-active" : ""} onClick={() => setSheetView("details")}>{tr("Про подію", "About")}</button>
            <button type="button" className={sheetView === "participants" ? "is-active" : ""} onClick={() => setSheetView("participants")}>{tr("Учасники", "Participants")} <span>{participants.length}{activity.capacity ? `/${activity.capacity}` : ""}</span></button>
            {isHost && <button type="button" className={sheetView === "edit" ? "is-active" : ""} onClick={openEditor}>{tr("Редагувати", "Edit")}</button>}
          </nav>

          {sheetView === "details" && (
            <section className="event-room-view">
              {activity.image_url && <div className="event-room-sheet__image"><img src={activity.image_url} alt="" /></div>}
              <div className="event-room-sheet__summary">
                <div className="event-room-sheet__time">{formatEventDateTime(activity.start_time, activity.end_time, language)}</div>
                <div className="room-sheet__meta">
                  {isHost && <span className="badge">{tr("Організатор", "Host")}</span>}
                  <span className="badge">{activity.visibility === "friends" ? tr("Лише друзі", "Friends only") : activity.visibility === "private" ? tr("Приватна", "Private") : tr("Публічна", "Public")}</span>
                </div>
              </div>
              {activity.description && <p className="room-sheet__hint">{activity.description}</p>}
              {activity.tags?.length > 0 && (
                <div className="event-tag-list" aria-label={tr("Теги події", "Event tags")}>
                  {activity.tags.map((tag) => <span className="event-tag" key={tag}>#{eventTagLabel(tag, language)}</span>)}
                </div>
              )}

              <div className="event-room-actions">
                {directionsUrl && (
                  <a className="button secondary event-directions-button" href={directionsUrl} target="_blank" rel="noreferrer">
                    <span>{tr("Маршрут у Google Maps", "Directions in Google Maps")}</span><AppIcon name="external-link" />
                  </a>
                )}
                {!isParticipant && (
                  <button className="button primary" type="button" onClick={joinEvent} disabled={joining}>
                    {joining ? tr("Приєднання...", "Joining...") : tr("Приєднатися до події", "Join event")}
                  </button>
                )}
                {!isHost && isParticipant && (
                  <button className="button danger-button" type="button" onClick={leaveEvent} disabled={leaving}>
                    {leaving ? tr("Від’єднання...", "Leaving...") : tr("Від’єднатися від події", "Leave event")}
                  </button>
                )}
                {isHost && (
                  <button className="button danger-button" type="button" onClick={deleteEvent} disabled={deleting}>
                    {deleting ? tr("Видалення...", "Deleting...") : tr("Видалити подію", "Delete event")}
                  </button>
                )}
              </div>
            </section>
          )}

          {sheetView === "participants" && (
            <section className="event-room-view event-participant-list">
              {participants.map((participant) => {
                const isSelf = participant.user_id === user?.id;
                const canAccept = participant.friendship_status === "pending" && participant.friendship_direction === "incoming";
                const canRequest = !participant.friendship_status && Boolean(participant.friend_code);
                return (
                  <article className="event-participant-row" key={participant.user_id}>
                    <div className="event-participant-row__avatar">
                      {participant.photo_url ? <img src={participant.photo_url} alt="" /> : initials(participant.name)}
                    </div>
                    <div className="event-participant-row__identity">
                      <strong>{participant.name}</strong>
                      <span>{participant.is_host ? tr("Організатор", "Host") : isSelf ? tr("Це ви", "This is you") : participant.friendship_status === "accepted" ? tr("У друзях", "Friend") : tr("Учасник", "Participant")}</span>
                    </div>
                    {!isSelf && (
                      <div className="event-participant-row__actions">
                        {(canAccept || canRequest) && (
                          <button className="small-action" type="button" onClick={() => updateFriendship(participant)} disabled={friendActionUserId !== null}>
                            {friendActionUserId === participant.user_id ? "..." : canAccept ? tr("Прийняти", "Accept") : tr("Додати в друзі", "Add friend")}
                          </button>
                        )}
                        {participant.friendship_status === "pending" && !canAccept && (
                          <span className="event-participant-row__pending">{tr("Запит надіслано", "Request sent")}</span>
                        )}
                        {isHost && !participant.is_host && (
                          <button
                            className="event-participant-row__remove"
                            type="button"
                            aria-label={tr(`Видалити ${participant.name} з події`, `Remove ${participant.name} from the event`)}
                            onClick={() => removeParticipant(participant)}
                            disabled={removingUserId !== null}
                          >
                            <AppIcon name={removingUserId === participant.user_id ? "loader" : "close"} className={removingUserId === participant.user_id ? "app-icon--spin" : ""} />
                          </button>
                        )}
                      </div>
                    )}
                  </article>
                );
              })}
            </section>
          )}

          {sheetView === "edit" && editForm && (
            <form className="event-room-view room-event-editor" onSubmit={saveEvent}>
              <label>{tr("Назва", "Name")}<input name="title" value={editForm.title} onChange={updateEditField} minLength="3" required /></label>
              <label>{tr("Опис", "Description")}<textarea name="description" value={editForm.description} onChange={updateEditField} rows="3" /></label>
              <EventTagPicker value={editForm.tags} onChange={(tags) => setEditForm((current) => ({ ...current, tags }))} />
              <div className="room-event-editor__columns">
                <label>{tr("Початок", "Start")}<input type="datetime-local" name="start_time" value={editForm.start_time} onChange={updateEditField} required /></label>
                <label>{tr("Завершення", "End")}<input type="datetime-local" name="end_time" value={editForm.end_time} min={editForm.start_time} onChange={updateEditField} /></label>
              </div>
              <div className="room-event-editor__columns">
                <label>{tr("Доступ", "Access")}
                  <select name="visibility" value={editForm.visibility} onChange={updateEditField}>
                    <option value="public">{tr("Публічна", "Public")}</option>
                    <option value="friends">{tr("Лише друзі", "Friends only")}</option>
                    <option value="private">{tr("Приватна", "Private")}</option>
                  </select>
                </label>
                <label>{tr("Позначка", "Pin")}
                  <select name="pin_type" value={editForm.pin_type} onChange={updateEditField}>
                    {EVENT_PINS.map((pin) => <option value={pin.id} key={pin.id}>{language === "en" ? pin.labelEn : pin.label}</option>)}
                  </select>
                </label>
              </div>
              <label className="capacity-toggle room-event-editor__capacity">
                <input type="checkbox" checked={editForm.capacity !== null} onChange={(event) => setEditCapacity(event.target.checked ? Math.max(participants.length, 8) : "")} />
                {tr("Обмежити кількість учасників", "Limit the number of participants")}
              </label>
              {editForm.capacity !== null && (
                <label>{tr("Місткість", "Capacity")}<input type="number" min={participants.length} max="50" value={editForm.capacity} onChange={(event) => setEditCapacity(event.target.value)} /></label>
              )}
              <div className="room-event-editor__image">
                {editForm.image_url && <img src={editForm.image_url} alt={tr("Попередній перегляд", "Preview")} />}
                <label className="small-action">{editForm.image_url ? tr("Змінити фото", "Change photo") : tr("Додати фото", "Add photo")}<input type="file" accept="image/*" onChange={(event) => handleEditImage(event.target.files[0])} /></label>
                {editForm.image_url && <button type="button" className="small-action small-action--danger" onClick={() => setEditForm((current) => ({ ...current, image_url: "" }))}>{tr("Видалити фото", "Remove photo")}</button>}
              </div>
              <div className="room-event-editor__location">
                <strong>{tr("Точка події", "Event location")}</strong>
                <EventLocationPicker value={editLocation} onChange={setEditLocation} />
              </div>
              <div className="event-room-actions event-room-actions--split">
                <button className="button primary" disabled={saving || !editLocation}>{saving ? tr("Збереження...", "Saving...") : tr("Зберегти зміни", "Save changes")}</button>
                <button className="button secondary" type="button" onClick={() => setSheetView("details")} disabled={saving}>{tr("Скасувати", "Cancel")}</button>
              </div>
            </form>
          )}

          {notice && <p className="success-message">{notice}</p>}
          {error && <p className="error">{error}</p>}
        </div>
      </aside>
      <ConfirmDialog
        open={Boolean(confirmation)}
        title={confirmation?.title}
        message={confirmation?.message}
        confirmLabel={confirmation?.confirmLabel}
        onCancel={() => setConfirmation(null)}
        onConfirm={confirmPendingAction}
      />
      <BottomNav />
    </main>
  );
}
