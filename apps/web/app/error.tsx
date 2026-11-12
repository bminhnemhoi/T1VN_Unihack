'use client';

/** Last-resort boundary (B22f state block): a Vietnamese message and a way out, never a blank screen. */
export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return (
    <main id="noi-dung" className="state in">
      <div className="stateBox" role="alert">
        <span className="label" style={{ color: 'var(--red-ink)' }}>
          Lỗi
        </span>
        <h1>Có lỗi xảy ra</h1>
        <p>Trang này gặp sự cố. Dữ liệu bạn đã nhập trên máy này vẫn được giữ.</p>
        <div className="actions">
          <button type="button" className="btn ink" onClick={reset}>
            Thử lại
          </button>
        </div>
      </div>
    </main>
  );
}
