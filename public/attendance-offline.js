(function () {
    const databaseName = 'smartschool-attendance';
    const databaseVersion = 1;
    let databasePromise;
    let currentUserId = null;
    let currentTeachers = [];
    let statusError = '';

    function openDatabase() {
        if (!databasePromise) {
            databasePromise = new Promise((resolve, reject) => {
                const request = indexedDB.open(databaseName, databaseVersion);
                request.onupgradeneeded = () => {
                    const database = request.result;
                    if (!database.objectStoreNames.contains('queue')) {
                        database.createObjectStore('queue', { keyPath: 'event_id' });
                    }
                    if (!database.objectStoreNames.contains('settings')) {
                        database.createObjectStore('settings', { keyPath: 'key' });
                    }
                };
                request.onsuccess = () => resolve(request.result);
                request.onerror = () => reject(request.error);
            });
        }
        return databasePromise;
    }

    async function transact(storeName, mode, callback) {
        const database = await openDatabase();
        return new Promise((resolve, reject) => {
            const transaction = database.transaction(storeName, mode);
            const request = callback(transaction.objectStore(storeName));
            transaction.oncomplete = () => resolve(request ? request.result : undefined);
            transaction.onerror = () => reject(transaction.error);
            transaction.onabort = () => reject(transaction.error || new Error('Offline storage was interrupted.'));
        });
    }

    function getSetting(key) {
        return transact('settings', 'readonly', store => store.get(key))
            .then(item => item && item.value);
    }

    function saveSetting(key, value) {
        return transact('settings', 'readwrite', store => store.put({ key, value }));
    }

    function getQueue() {
        return transact('queue', 'readonly', store => store.getAll());
    }

    function deleteQueuedEvent(eventId) {
        return transact('queue', 'readwrite', store => store.delete(eventId));
    }

    function makeEventId() {
        if (crypto.randomUUID) return crypto.randomUUID();
        const bytes = crypto.getRandomValues(new Uint8Array(16));
        bytes[6] = (bytes[6] & 0x0f) | 0x40;
        bytes[8] = (bytes[8] & 0x3f) | 0x80;
        const hex = [...bytes].map(value => value.toString(16).padStart(2, '0')).join('');
        return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
    }

    async function requestSession() {
        let response;
        try {
            response = await fetch('/api/session', {
                headers: { Accept: 'application/json' },
                cache: 'no-store'
            });
        } catch (error) {
            throw new Error('Connection lost. Attendance remains saved on this device until the server can be reached.');
        }
        if (!response.ok) {
            const error = new Error(response.status === 401
                ? 'Sign in online before using offline attendance.'
                : 'Unable to verify your account. Try again when online.');
            error.status = response.status;
            throw error;
        }
        const data = await response.json();
        const user = data.user || data;
        if (user.id === undefined || user.id === null) {
            throw new Error('The server did not return a valid account.');
        }
        return String(user.id);
    }

    async function loadTeachersFromServer() {
        const response = await fetch('/api/teachers', {
            headers: { Accept: 'application/json' },
            cache: 'no-store'
        });
        if (!response.ok) throw new Error('Unable to load the teacher list.');
        const teachers = await response.json();
        if (!Array.isArray(teachers)) throw new Error('The server returned an invalid teacher list.');
        return teachers
            .filter(teacher => Number.isSafeInteger(Number(teacher.id)) && Number(teacher.id) > 0 && typeof teacher.name === 'string')
            .map(teacher => ({ id: Number(teacher.id), name: teacher.name }));
    }

    async function getCurrentQueue() {
        if (!currentUserId) return [];
        return (await getQueue()).filter(item => item.user_id === currentUserId);
    }

    function renderQueue(items) {
        const panel = document.getElementById('pendingPanel');
        const list = document.getElementById('pendingList');
        panel.hidden = items.length === 0;
        list.replaceChildren();

        const timeFormatter = new Intl.DateTimeFormat('en-GB', {
            timeZone: 'Africa/Kigali',
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
        items.sort((left, right) => left.recorded_at.localeCompare(right.recorded_at));
        for (const item of items) {
            const row = document.createElement('li');
            row.className = 'pending-item';
            const details = document.createElement('span');
            const action = item.action === 'checkin' ? 'Check-in' : 'Check-out';
            details.textContent = `${item.teacher_name} · ${action} · ${timeFormatter.format(new Date(item.recorded_at))}`;
            const remove = document.createElement('button');
            remove.type = 'button';
            remove.textContent = 'Remove';
            remove.setAttribute('aria-label', `Remove pending ${action.toLowerCase()} for ${item.teacher_name}`);
            remove.addEventListener('click', async () => {
                if (!window.confirm('Remove this attendance entry saved on this device?')) return;
                await deleteQueuedEvent(item.event_id);
                await updateStatus();
            });
            row.append(details, remove);
            list.append(row);
        }
    }

    async function updateStatus() {
        const status = document.getElementById('offlineStatus');
        const queue = await getCurrentQueue();
        renderQueue(queue);

        if (statusError) {
            status.dataset.state = 'error';
            status.textContent = `${statusError} ${queue.length} ${queue.length === 1 ? 'entry remains' : 'entries remain'} on this device.`;
        } else if (!navigator.onLine) {
            status.dataset.state = queue.length ? 'pending' : 'offline';
            status.textContent = queue.length
                ? `Offline. ${queue.length} attendance ${queue.length === 1 ? 'entry is' : 'entries are'} saved on this device and will sync when connection returns.`
                : 'Offline. Attendance entries will be saved on this device and synced when connection returns.';
        } else if (queue.length) {
            status.dataset.state = 'pending';
            status.textContent = `Online. ${queue.length} attendance ${queue.length === 1 ? 'entry is' : 'entries are'} waiting for server confirmation.`;
        } else {
            status.dataset.state = 'online';
            status.textContent = 'Online. Offline attendance is ready; queued entries sync automatically.';
        }
    }

    async function syncQueue() {
        statusError = '';
        if (!navigator.onLine || !currentUserId) {
            await updateStatus();
            return 0;
        }

        try {
            const sessionUserId = await requestSession();
            if (sessionUserId !== currentUserId) {
                throw new Error('The signed-in account changed. Reload this page before syncing saved attendance.');
            }

            const items = (await getCurrentQueue())
                .sort((left, right) => left.recorded_at.localeCompare(right.recorded_at));
            let syncedCount = 0;
            for (const item of items) {
                let response;
                try {
                    response = await fetch('/save-attendance', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
                        body: JSON.stringify({
                            teacher_id: item.teacher_id,
                            action: item.action,
                            client_event_id: item.event_id,
                            recorded_at: item.recorded_at
                        })
                    });
                } catch (error) {
                    statusError = 'Connection lost while syncing.';
                    break;
                }

                const data = await response.json().catch(() => null);
                if (!response.ok || !data || data.status !== 'success') {
                    statusError = data && data.message
                        ? data.message
                        : response.status === 401
                            ? 'Sign in again online to sync attendance.'
                            : 'The server could not confirm a queued entry.';
                    break;
                }
                await deleteQueuedEvent(item.event_id);
                syncedCount += 1;
            }

            if (syncedCount && !statusError) {
                statusError = '';
            }
            await updateStatus();
            return syncedCount;
        } catch (error) {
            statusError = error.message || 'Attendance could not be synced.';
            await updateStatus();
            return 0;
        }
    }

    async function initialize() {
        let teachers;
        try {
            currentUserId = await requestSession();
            await saveSetting('last_user_id', currentUserId);
            teachers = await loadTeachersFromServer();
            await saveSetting(`teachers:${currentUserId}`, teachers);
            statusError = '';
        } catch (error) {
            if (error.status === 401 || error.status === 403) {
                currentUserId = null;
                await updateStatus();
                throw error;
            }
            if (!currentUserId) {
                currentUserId = await getSetting('last_user_id');
            }
            if (!currentUserId) {
                throw new Error('Connect and sign in once to prepare offline attendance.');
            }
            teachers = await getSetting(`teachers:${currentUserId}`);
            if (!Array.isArray(teachers) || teachers.length === 0) {
                throw new Error('Connect online once to load and save the teacher list for offline use.');
            }
            statusError = '';
        }

        currentTeachers = teachers;
        await updateStatus();
        if (navigator.onLine) await syncQueue();
        return currentTeachers;
    }

    async function record({ teacher_id, action, teacher_name }) {
        if (!currentUserId) throw new Error('Connect and sign in once before recording attendance offline.');
        const teacherId = Number(teacher_id);
        if (!Number.isSafeInteger(teacherId) || teacherId < 1 || !['checkin', 'checkout'].includes(action)) {
            throw new Error('Select a valid staff member and attendance type.');
        }
        const teacher = currentTeachers.find(item => item.id === teacherId);
        if (!teacher) throw new Error('This staff member is not in the saved teacher list. Reconnect and reload the page.');

        await transact('queue', 'readwrite', store => store.put({
            event_id: makeEventId(),
            user_id: currentUserId,
            teacher_id: teacherId,
            teacher_name: teacher.name || teacher_name,
            action,
            recorded_at: new Date().toISOString()
        }));
        await updateStatus();
        if (navigator.onLine) await syncQueue();
        const stillPending = (await getCurrentQueue()).length;
        return { synced: stillPending === 0 };
    }

    async function reconnect() {
        try {
            await initialize();
        } catch (error) {
            statusError = error.message || 'Unable to resume offline attendance.';
            await updateStatus();
            throw error;
        }
    }

    window.smartSchoolOffline = {
        initialize,
        record,
        reconnect,
        updateStatus
    };
})();
