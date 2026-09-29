import { useEffect, useRef, useState } from 'react';
import { CoreError } from '../../core/core';
import { digits } from '../../i18n';
import { notifications } from '../../platform/notifications';
import { APP_VERSION, isNative, keepPrivateBackup, shareFile } from '../../platform/device';
import { TimeField } from '../components/TimeField';
import { refreshUpdate, useUpdate } from '../components/UpdateBanner';
import { useApp } from '../context';
import { Icon } from '../icons';

export function Settings() {
  const { core, lang, t, toast, ask } = useApp();
  const s = core.settings;
  const [exact, setExact] = useState(true);
  const [checking, setChecking] = useState(false);
  const { latest, checked } = useUpdate();
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    notifications.exactAllowed().then(setExact);
  }, []);

  const stamp = () => core.now().toISOString().slice(0, 16).replace(/[:T]/g, '-');

  async function toggleBedtime() {
    const on = !s.bedtimeEnabled;
    core.updateSettings({ bedtimeEnabled: on });
    if (on) {
      await notifications.ensurePermission(!s.exactAlarmAsked);
      core.updateSettings({ exactAlarmAsked: true });
      setExact(await notifications.exactAllowed());
    }
  }

  async function exportNow() {
    try {
      await shareFile(`my-to-do-${stamp()}.json`, core.exportBackup());
      toast(t.exportDone);
    } catch {
      /* the user closed the share sheet */
    }
  }

  async function importFile(file: File) {
    const text = await file.text();
    const choice = await ask(t.importTitle, t.importBody, [{ value: 'ok', label: t.importConfirm, tone: 'danger' }]);
    if (choice !== 'ok') return;
    const before = core.exportBackup();
    try {
      await keepPrivateBackup(`before-import-${stamp()}.json`, before);
      if (!isNative) await shareFile(`my-to-do-before-import-${stamp()}.json`, before);
      core.importBackup(text);
      toast(t.importDone);
    } catch (e) {
      toast(e instanceof CoreError && e.code === 'backup-newer' ? t.importNewer : t.importInvalid);
    }
  }

  async function check() {
    setChecking(true);
    await refreshUpdate();
    setChecking(false);
  }

  return (
    <div className="screen" data-testid="settings">
      <header className="topbar">
        <h1>{t.settings}</h1>
      </header>

      <div className="card">
        <div className="card-row">
          <div className="grow">{t.language}</div>
          <div className="seg">
            <button aria-pressed={lang === 'fa'} onClick={() => core.updateSettings({ language: 'fa' })} lang="fa">
              {t.languageFa}
            </button>
            <button aria-pressed={lang === 'en'} onClick={() => core.updateSettings({ language: 'en' })} lang="en">
              {t.languageEn}
            </button>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-row">
          <div className="grow">
            {t.bedtime}
            <small>{t.bedtimeHint}</small>
          </div>
          <button className="switch" role="switch" aria-checked={s.bedtimeEnabled} aria-label={t.bedtime} onClick={toggleBedtime} />
        </div>
        {s.bedtimeEnabled && (
          <div className="card-row">
            <label className="grow" htmlFor="bedtime-time-hour">
              {t.bedtimeTime}
            </label>
            <TimeField id="bedtime-time" value={s.bedtimeTime} onChange={(v) => v && core.updateSettings({ bedtimeTime: v })} />
          </div>
        )}
        {isNative && !exact && (
          <div className="card-row">
            <div className="grow">
              <small>{t.exactAlarmOff}</small>
            </div>
            <button
              className="text-btn"
              onClick={async () => {
                await notifications.openExactSettings();
                setExact(await notifications.exactAllowed());
              }}
            >
              {t.openAlarmSettings}
            </button>
          </div>
        )}
      </div>

      <div className="card">
        <div className="card-row">
          <div className="grow">{t.backup}</div>
        </div>
        <div className="card-row">
          <button className="text-btn" onClick={exportNow}>
            <Icon name="download" small /> {t.exportBackup}
          </button>
          <button className="text-btn" onClick={() => fileRef.current?.click()}>
            <Icon name="upload" small /> {t.importBackup}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            hidden
            data-testid="import-input"
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = '';
              if (f) importFile(f);
            }}
          />
        </div>
      </div>

      <div className="card">
        <div className="card-row">
          <div className="grow">
            {t.appName}
            <small>
              {t.version} {digits(lang, APP_VERSION)}
            </small>
          </div>
          <button className="text-btn" onClick={check} disabled={checking}>
            {t.checkUpdate}
          </button>
        </div>
        {checked && (
          <div className="card-row">
            {latest ? (
              <>
                <div className="grow">{t.updateAvailable}</div>
                <a className="text-btn" href={latest.url} target="_blank" rel="noreferrer">
                  {t.download}
                </a>
              </>
            ) : (
              <div className="grow muted">{t.upToDate}</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
