import { useEffect, useState, type ReactNode } from 'react';
import { api } from './api';
import { getZaloAccessToken, getZaloLocationToken } from './zalo';
import { emptySchedule, getWorkWeek, shifts, weekdays } from './week';
import type { CheckStatus, Leader, LocationCheck, Session, Shift, WorkSchedule } from './types';

type Screen = 'home' | 'schedule' | 'attendance' | 'result';
type Result = 'schedule' | 'checkin' | 'checkout';
const backendTestMode = import.meta.env.VITE_BACKEND_TEST_MODE === 'true';
const zone = 'Asia/Ho_Chi_Minh';
const formatDate = (date: Date, options: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat('vi-VN', { timeZone: zone, ...options }).format(date);
const timeNow = () => formatDate(new Date(), { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
const errorMessage = (error: unknown) => error instanceof Error ? error.message : 'Có lỗi xảy ra. Vui lòng thử lại.';
const iconPaths: Record<string, ReactNode> = {
  home: <path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z" />,
  calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M7 3v4M17 3v4M3 10h18M7 14h2M12 14h2M7 18h2M12 18h2" /></>,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 6v6l4 2" /></>,
  pin: <><path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0z" /><circle cx="12" cy="10" r="3" /></>,
  scan: <path d="M8 3H5a2 2 0 0 0-2 2v3M16 3h3a2 2 0 0 1 2 2v3M3 16v3a2 2 0 0 0 2 2h3M21 16v3a2 2 0 0 1-2 2h-3" />,
  info: <><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 8h.01" /></>,
  alert: <><circle cx="12" cy="12" r="9" /><path d="M12 7v6M12 17h.01" /></>,
  check: <><circle cx="12" cy="12" r="9" /><path d="m8 12 3 3 5-6" /></>,
  user: <><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></>,
  arrow: <path d="M4 12h16m-6-6 6 6-6 6" />,
  login: <path d="M10 5H5v14h5M14 7l5 5-5 5M19 12H9" />,
  logout: <path d="M14 5h5v14h-5M10 7l-5 5 5 5M5 12h10" />,
};
function Icon({ name }: { name: string }) {
  return <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">{iconPaths[name]}</svg>;
}
function Message({ kind, title, children }: { kind: 'info' | 'success' | 'error'; title: string; children: ReactNode }) {
  return <div className={`message ${kind}`}><span><Icon name={kind === 'error' ? 'alert' : kind === 'success' ? 'check' : 'info'} /></span><div><strong>{title}</strong><p>{children}</p></div></div>;
}
function TimePair({ checkin, checkout, checkinAt, checkoutAt }: { checkin: boolean; checkout: boolean; checkinAt?: string | null; checkoutAt?: string | null }) {
  return <div className="time-pair"><div><small>Giờ vào</small><strong className={checkin && checkinAt ? 'has-time' : ''}>{checkin && checkinAt ? checkinAt : '—:—'}</strong></div><div><small>Giờ ra</small><strong className={checkout && checkoutAt ? 'has-time' : ''}>{checkout && checkoutAt ? checkoutAt : '—:—'}</strong></div></div>;
}
function displayRecordedTime(value?: string | null): string | null {
  if (!value) return null;
  if (/^\d{1,2}:\d{2}$/.test(value)) return value;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : formatDate(date, { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
}
export function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [linkError, setLinkError] = useState('');
  const [linkReady, setLinkReady] = useState(false);
  const [linking, setLinking] = useState(false);
  const [linkAttempt, setLinkAttempt] = useState(0);
  const [screen, setScreen] = useState<Screen>('home');
  const [result, setResult] = useState<Result>('checkin');
  const [status, setStatus] = useState<CheckStatus | null>(null);
  const [checkinAt, setCheckinAt] = useState<string | null>(null);
  const [checkoutAt, setCheckoutAt] = useState<string | null>(null);
  const [leaders, setLeaders] = useState<Leader[]>([]);
  const [schedule, setSchedule] = useState<WorkSchedule>(emptySchedule);
  const [savedSchedule, setSavedSchedule] = useState<WorkSchedule>(emptySchedule);
  const [mentorEmail, setMentorEmail] = useState('');
  const [savedMentor, setSavedMentor] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [clock, setClock] = useState(timeNow);
  const [locationTestBusy, setLocationTestBusy] = useState(false);
  const [locationTestMessage, setLocationTestMessage] = useState('');
  const [locationCheck, setLocationCheck] = useState<LocationCheck | null>(null);
  const week = getWorkWeek();
  const selectedCount = Object.values(schedule).filter(Boolean).length;
  const checkinWindow = Number(clock.slice(0, 2)) === 9;
  const canCheckOut = !!status?.checkin && !status?.checkout;
  const locationReady = !!status && !!locationCheck && locationCheck.withinOfficeRadius &&
    (canCheckOut || locationCheck.withinCheckInWindow) && !status?.checkout;
  const shiftLabels: Record<Shift, string> = { fulltime: 'Toàn thời gian', halfmorning: 'Buổi sáng', halfafternoon: 'Buổi chiều', online: 'Làm việc online' };
  const selectedMentor = leaders.find((leader) => leader.email === savedMentor)?.fullname || savedMentor;
  const show = (next: Screen) => { setScreen(next); setError(''); window.scrollTo(0, 0); };

  useEffect(() => {
    const timer = window.setInterval(() => setClock(timeNow()), 30000);
    return () => window.clearInterval(timer);
  }, []);
  async function connectZalo() {
    if (!api.configured || linking) return;
    setLinking(true);
    setLinkError('');
    try {
      await api.checkBackendHealth();
      const worklySession = await (backendTestMode ? api.testSession() : getZaloAccessToken().then(api.zaloSession)).catch((reason: unknown) => {
        throw new Error(`Không thể kết nối tài khoản: ${errorMessage(reason)}`);
      });
      setSession(worklySession);
    } catch (reason) {
      setLinkError(errorMessage(reason));
    } finally {
      setLinking(false);
    }
  }
  useEffect(() => {
    if (!api.configured) {
      setLinkReady(true);
      return;
    }
    let active = true;
    const timer = window.setTimeout(() => {
      if (active) void connectZalo().finally(() => { if (active) setLinkReady(true); });
    }, 0);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [linkAttempt]);
  useEffect(() => {
    if (!session) return;
    let active = true;
    setLoading(true);
    Promise.allSettled([api.status(session.token), api.leaders(session.token), api.savedSchedule(session.token, week.startDate)]).then(([statusResult, leadersResult, scheduleResult]) => {
      if (!active) return;
      if (statusResult.status === 'fulfilled') {
        setStatus(statusResult.value);
        setCheckinAt(displayRecordedTime(statusResult.value.checkinAt));
        setCheckoutAt(displayRecordedTime(statusResult.value.checkoutAt));
      }
      else setError(`Không tải được trạng thái: ${errorMessage(statusResult.reason)}`);
      if (leadersResult.status === 'fulfilled') setLeaders(leadersResult.value);
      else setError((current) => `${current} Không tải được danh sách mentor.`.trim());
      if (scheduleResult.status === 'fulfilled' && scheduleResult.value.schedule) {
        const saved = scheduleResult.value.schedule;
        const shifts = { monday: saved.monday, tuesday: saved.tuesday, wednesday: saved.wednesday, thursday: saved.thursday, friday: saved.friday };
        setSchedule(shifts); setSavedSchedule(shifts);
        setMentorEmail(saved.mentorEmail); setSavedMentor(saved.mentorEmail);
      } else if (scheduleResult.status === 'rejected') {
        setError((current) => `${current} Không tải được lịch đã lưu.`.trim());
      }
      setLoading(false);
    });
    return () => { active = false; };
  }, [session]);

  async function testLocationPermission() {
    if (!session) return;
    setLocationTestBusy(true); setLocationTestMessage(''); setLocationCheck(null);
    try {
      const zaloAccessToken = await getZaloAccessToken();
      const locationToken = await getZaloLocationToken();
      setLocationCheck(await api.checkLocation(session.token, locationToken, zaloAccessToken));
    } catch (reason) {
      setLocationTestMessage(errorMessage(reason));
    } finally {
      setLocationTestBusy(false);
    }
  }
  async function saveSchedule() {
    if (!session || !selectedCount || !mentorEmail || busy) return;
    setBusy(true); setError('');
    try {
      await api.saveSchedule(session.token, mentorEmail, week.startDate, schedule);
      setSavedSchedule({ ...schedule }); setSavedMentor(mentorEmail); setResult('schedule'); show('result');
    } catch (reason) { setError(errorMessage(reason)); }
    finally { setBusy(false); }
  }
  async function markAttendance() {
    if (!session || !status || busy || loading) return;
    const action = status.checkin ? 'out' : 'in';
    setBusy(true); setError('');
    try {
      const zaloAccessToken = await getZaloAccessToken();
      const locationToken = await getZaloLocationToken();
      const updated = action === 'in'
        ? await api.checkIn(session.token, locationToken, zaloAccessToken)
        : await api.checkOut(session.token, locationToken, zaloAccessToken);
      setStatus(updated);
      if (action === 'in') setCheckinAt(displayRecordedTime(updated.checkinAt || updated.recordedAt));
      else setCheckoutAt(displayRecordedTime(updated.checkoutAt || updated.recordedAt));
      setResult(action === 'in' ? 'checkin' : 'checkout'); show('result');
    } catch (reason) { setError(errorMessage(reason)); }
    finally { setBusy(false); }
  }
  const resultTitle = result === 'schedule' ? 'Đã lưu lịch làm việc!' : result === 'checkin' ? 'Chấm công vào thành công!' : 'Chấm công ra thành công!';
  return <div className="app-shell">
    <header className="topbar"><div className="brand"><strong>MeU Workly</strong><small>ĐỒNG HÀNH THỰC TẬP</small></div></header>
    <>
      <main id="main-content">
        {error && <div className="global-feedback"><Message kind="error" title="Không thể hoàn tất">{error}</Message></div>}
        <section id="home-screen" className={`screen ${screen === 'home' ? 'is-active' : ''}`}>
          <div className="hero"><div className="hero-top"><span className="eyebrow">KHÔNG GIAN LÀM VIỆC</span><span className="sparkle" aria-hidden="true">✧</span></div><h1>Chào bạn!</h1><p>Một tuần mới, nhiều điều hay.<br />Sẵn sàng cùng MeU nhé!</p><span className="hero-date"><Icon name="calendar" />{formatDate(new Date(), { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</span></div>
          {!session && linkReady && (!api.configured || linkError) && <div className="connection-error"><Message kind="error" title="Không thể kết nối">{linkError || 'Ứng dụng chưa được cấu hình địa chỉ API.'}</Message>{api.configured && <button className="secondary-button" type="button" disabled={linking} onClick={() => { setLinkError(''); setLinkReady(false); setLinkAttempt((attempt) => attempt + 1); }}>Kết nối lại</button>}</div>}
          <div className="section-heading"><h2>Hôm nay</h2><span className="plain-status">• {status?.checkout ? 'Đã hoàn tất' : status?.checkin ? 'Đã check-in' : status ? 'Chưa chấm công' : 'Chưa có dữ liệu'}</span></div>
          <div className="home-attendance card"><div className="home-status-top"><span className="icon-tile"><Icon name="clock" /></span><div><strong>{status?.checkout ? 'Đã hoàn tất chấm công' : status?.checkin ? 'Đang trong ngày làm việc' : 'Sẵn sàng bắt đầu ngày làm việc'}</strong><small>{loading ? 'Đang tải trạng thái…' : status ? 'Trạng thái chấm công hôm nay' : 'Chưa tải được trạng thái'}</small></div></div><TimePair checkin={!!status?.checkin} checkout={!!status?.checkout} checkinAt={checkinAt} checkoutAt={checkoutAt} /></div>
          <div className="section-heading actions-heading"><h2>Bạn muốn làm gì?</h2></div>
          <button className="quick-card card" type="button" onClick={() => show('schedule')}><span className="icon-tile"><Icon name="calendar" /></span><span className="quick-copy"><strong>Đăng ký lịch làm việc</strong><small>Chọn ca và mentor cho tuần mới</small></span><span className="chevron">›</span></button>
          <button className="quick-card card" type="button" onClick={() => show('attendance')}><span className="icon-tile"><Icon name="scan" /></span><span className="quick-copy"><strong>Chấm công</strong><small>Ghi nhận giờ vào, giờ ra tại văn phòng</small></span><span className="chevron">›</span></button>
          <div className="home-message"><Message kind="info" title={`Tuần làm việc ${week.label}`}>Đăng ký lịch sớm để mentor sắp xếp đồng hành cùng bạn.</Message></div>
        </section>
        <section id="schedule-screen" className={`screen ${screen === 'schedule' ? 'is-active' : ''}`}>
          <div className="page-head"><span className="eyebrow">LỊCH LÀM VIỆC</span><h1>Đăng ký lịch làm</h1><p>Chủ động lịch trình, sẵn sàng cho tuần mới.</p></div>
          <div className="week-card card"><span className="icon-tile"><Icon name="calendar" /></span><div><small>Tuần làm việc · Thứ Hai – Thứ Sáu</small><strong>{week.label}</strong></div></div>
          <div className="section-heading schedule-heading"><h2>Chọn ngày và ca làm</h2><span className="count-pill">• {selectedCount} ngày đã chọn</span></div><p className="section-help">Mỗi ngày chọn tối đa một ca. Nhấn ca đang chọn để bỏ chọn.</p>
          <div className="day-list">{weekdays.map(({ key, label }, index) => <article className={`day-card card ${schedule[key] ? 'selected' : ''}`} key={key}><div className="day-title"><strong>{label}</strong><small>{formatDate(week.dates[index], { day: 'numeric', month: 'numeric' })}</small>{schedule[key] && <span className="selected-mark"><Icon name="check" /></span>}</div><div className="shift-list">{shifts.map((shift) => <button key={shift.value} type="button" className={`shift-button ${schedule[key] === shift.value ? 'selected' : ''}`} aria-pressed={schedule[key] === shift.value} onClick={() => setSchedule((current) => ({ ...current, [key]: current[key] === shift.value ? null : shift.value }))}>{schedule[key] === shift.value && <Icon name="check" />}{shiftLabels[shift.value]}</button>)}</div></article>)}</div>
          <div className="mentor-area"><label htmlFor="mentor-select">Mentor phụ trách *</label><div className="mentor-field"><Icon name="user" /><select id="mentor-select" value={mentorEmail} onChange={(event) => setMentorEmail(event.target.value)}><option value="">Chọn mentor của bạn</option>{leaders.map((leader) => <option key={leader.email} value={leader.email}>{leader.fullname} · {leader.email}</option>)}</select><Icon name="arrow" /></div><p className="field-hint">{leaders.length ? 'Mentor sẽ đồng hành cùng bạn trong tuần này.' : 'Chưa tải được danh sách mentor.'}</p></div>
          <button className="primary-button" type="button" disabled={busy || loading || !selectedCount || !mentorEmail || !session || !leaders.some((leader) => leader.email === mentorEmail)} onClick={saveSchedule}>{busy ? 'Đang lưu…' : savedMentor ? 'Cập nhật lịch làm việc' : 'Lưu lịch làm việc'} <Icon name="arrow" /></button><p className="button-footnote">{!session ? 'Đang kết nối…' : selectedCount && mentorEmail ? `${selectedCount} ngày làm việc · 1 mentor · Sẵn sàng để lưu` : 'Chọn ít nhất một ngày và mentor để lưu.'}</p>
        </section>
        <section id="attendance-screen" className={`screen ${screen === 'attendance' ? 'is-active' : ''}`}>
          <div className="page-head"><span className="eyebrow">CHẤM CÔNG</span><h1>{canCheckOut ? 'Kết thúc ngày làm việc' : 'Bắt đầu ngày làm việc'}</h1><p>{formatDate(new Date(), { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' })} · Văn phòng MeU</p></div>
          <div className="attendance-card card"><div className="attendance-card-head"><strong>Chấm công hôm nay</strong><span className={`status-pill ${status?.checkin ? 'green' : 'blue'}`}>• {status?.checkout ? 'Đã hoàn tất' : status?.checkin ? 'Đã check-in' : 'Chưa check-in'}</span></div><TimePair checkin={!!status?.checkin} checkout={!!status?.checkout} checkinAt={checkinAt} checkoutAt={checkoutAt} /><p>{status?.checkin ? 'Giờ vào đã được ghi nhận.' : 'Chưa ghi nhận giờ vào trong ngày làm việc này.'}</p></div>
          <div className="section-heading conditions-heading"><h2>{canCheckOut ? 'Điều kiện chấm công ra' : 'Điều kiện chấm công vào'}</h2><span>{canCheckOut ? 'Vị trí xác minh khi gửi' : 'Giờ và vị trí xác minh khi gửi'}</span></div>
          <div id="location-card" className="condition-card card"><div className="condition-main"><span className="icon-tile"><Icon name="pin" /></span><div><strong>Vị trí văn phòng</strong><small>Kiểm tra bằng vị trí Zalo</small></div><span className="condition-mark"><Icon name="info" /></span></div><p>Vị trí cần nằm trong bán kính 50 m của văn phòng khi bạn chấm công.</p></div>
          <div className="location-test">
            <button className="secondary-button" type="button" disabled={locationTestBusy || !session} onClick={testLocationPermission}>{locationTestBusy ? 'Đang kiểm tra vị trí…' : 'Kiểm tra vị trí trên Zalo'}</button>
            {locationTestMessage && <p role="alert">{locationTestMessage}</p>}
            {locationCheck && <div className={`location-check-result ${locationReady ? 'good' : 'bad'}`} role="status">
              <strong>{locationReady ? `✓ Đủ điều kiện ${canCheckOut ? 'chấm công ra' : 'chấm công vào'}` : '✕ Chưa đủ điều kiện chấm công'}</strong>
              <p>Vị trí của bạn: {locationCheck.latitude.toFixed(6)}, {locationCheck.longitude.toFixed(6)}</p>
              <p>Cách văn phòng 03 Sông Thao khoảng {locationCheck.distanceMeters.toLocaleString('vi-VN')} m · Giới hạn {locationCheck.maximumDistanceMeters} m</p>
              <p>{locationCheck.withinOfficeRadius ? '✓ Trong phạm vi văn phòng' : '✕ Ngoài phạm vi văn phòng'}</p>
              <p>{status?.checkout ? 'Hôm nay đã hoàn tất chấm công.' : status?.checkin ? 'Chấm công ra không giới hạn giờ; vẫn cần ở trong phạm vi.' : locationCheck.withinCheckInWindow ? 'Đang trong khung giờ check-in 09:00–10:00.' : 'Ngoài khung giờ check-in 09:00–10:00.'}</p>
              <small>Vị trí sẽ được xác minh lại khi bạn chấm công.</small>
            </div>}
          </div>
          <div id="time-card" className={`condition-card card ${!canCheckOut && !checkinWindow ? 'bad' : 'good'}`}><div className="condition-main"><span className="icon-tile"><Icon name="clock" /></span><div><strong>Giờ hiện tại</strong><small>Giờ Việt Nam</small></div><b>{clock}</b></div><div className="condition-footer"><Icon name={canCheckOut || checkinWindow ? 'check' : 'alert'} /><span>{canCheckOut ? 'Chấm công ra không giới hạn khung giờ 09:00–10:00.' : 'Chấm công vào từ 09:00 đến trước 10:00 · Giờ Việt Nam'}</span></div></div>
          <div id="attendance-message"><Message kind={status?.checkout ? 'success' : !status ? 'info' : !canCheckOut && !checkinWindow ? 'error' : 'info'} title={status?.checkout ? 'Bạn đã hoàn tất chấm công' : !status ? 'Đang chờ trạng thái' : !canCheckOut && !checkinWindow ? 'Ngoài giờ chấm công vào' : 'Sẵn sàng xác minh vị trí'}>{status?.checkout ? 'Không cần chấm công thêm hôm nay.' : 'Vị trí sẽ được kiểm tra an toàn trên backend khi bạn xác nhận.'}</Message></div>
          <button className="primary-button" type="button" disabled={busy || loading || !status || !!status.checkout || (!status.checkin && !checkinWindow)} onClick={markAttendance}>{busy ? 'Đang xử lý…' : status?.checkout ? 'Đã hoàn tất' : canCheckOut ? 'Chấm công ra' : 'Chấm công vào'} <Icon name={canCheckOut ? 'logout' : 'login'} /></button><p className="button-footnote">Kết quả được ghi nhận sau khi xác minh vị trí và thời gian.</p>
        </section>
        <section id="result-screen" className={`screen ${screen === 'result' ? 'is-active' : ''}`}><div className="result-symbol"><Icon name="check" /></div><h1 id="result-title">{resultTitle}</h1><p className="result-subtitle">{result === 'schedule' ? 'Lịch của bạn đã được gửi thành công.' : result === 'checkin' ? 'Giờ vào đã được ghi nhận. Chúc bạn một ngày làm việc hiệu quả!' : 'Giờ ra đã được ghi nhận. Hẹn gặp lại bạn vào ngày làm việc tiếp theo!'}</p>
          <div className="result-card card">{result === 'schedule' ? <><div className="result-card-week"><span className="status-pill green">{Object.values(savedSchedule).filter(Boolean).length} ngày</span><small>Tuần làm việc</small><strong>{week.label}</strong></div><div className="saved-rows">{weekdays.map(({ key, label }, index) => ({ key, label, date: week.dates[index] })).filter(({ key }) => savedSchedule[key]).map(({ key, label, date }) => <div className="saved-row" key={key}><div><span>{label}</span><small>{formatDate(date, { day: '2-digit', month: '2-digit' })}</small></div><div><strong>{shiftLabels[savedSchedule[key] as Shift]}</strong></div><Icon name="check" /></div>)}</div><div className="saved-mentor"><span className="avatar">{selectedMentor.charAt(0)}</span><div><small>Mentor phụ trách</small>{selectedMentor}</div></div></> : <><div className="result-card-head"><div><strong>{formatDate(new Date(), { weekday: 'long' })}</strong><small>{formatDate(new Date(), { day: '2-digit', month: '2-digit', year: 'numeric' })}</small></div><span className="status-pill green">• {status?.checkout ? 'Đã hoàn tất' : 'Đã check-in'}</span></div><TimePair checkin={!!status?.checkin} checkout={!!status?.checkout} checkinAt={checkinAt} checkoutAt={checkoutAt} /><div className="location-strip"><Icon name="pin" /> Văn phòng MeU · Trong phạm vi 50 m</div></>}</div>
          <div id="result-message"><Message kind={result === 'schedule' || result === 'checkin' ? 'success' : 'info'} title={result === 'schedule' ? 'Đã ghi nhận lịch làm việc' : result === 'checkin' ? 'Tiếp theo: chấm công ra' : 'Đã hoàn tất ngày làm việc'}>{result === 'schedule' ? 'Bạn có thể tiếp tục theo dõi chấm công hôm nay.' : result === 'checkin' ? 'Khi kết thúc làm việc, hãy ở trong phạm vi văn phòng để chấm công ra.' : 'Không cần chấm công thêm hôm nay.'}</Message></div>
          <button className="primary-button" onClick={() => show(result === 'checkin' ? 'attendance' : 'home')}>{result === 'checkin' ? 'Chuyển sang chấm công ra' : 'Về Trang chủ'} <Icon name="arrow" /></button><button className="secondary-button" onClick={() => show(result === 'schedule' ? 'schedule' : 'home')}>{result === 'schedule' ? 'Chỉnh sửa lịch' : 'Về Trang chủ'}</button>
        </section>
      </main>
      <nav className="bottom-nav" aria-label="Điều hướng chính">{([['home', 'Trang chủ', 'home'], ['schedule', 'Lịch làm', 'calendar'], ['attendance', 'Chấm công', 'clock']] as const).map(([target, label, icon]) => <button type="button" key={target} className={`nav-item ${screen === target || screen === 'result' && (result === 'schedule' ? target === 'schedule' : target === 'attendance') ? 'is-active' : ''}`} aria-current={screen === target ? 'page' : undefined} onClick={() => show(target)}><span className="nav-icon"><Icon name={icon} /></span><small>{label}</small></button>)}</nav>
    </>
  </div>;
}
