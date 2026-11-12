import Link from 'next/link';

export const metadata = { title: 'Không tìm thấy trang' };

/** 404 inside the app frame (B22f state block): what happened and two ways out, the main one solid. */
export default function NotFound() {
  return (
    <main id="noi-dung" className="state in">
      <div className="stateBox">
        <span className="label">Lỗi 404</span>
        <h1>Không tìm thấy trang này</h1>
        <p>Đường dẫn có thể đã gõ sai hoặc trang đã được dời đi.</p>
        <div className="actions">
          <Link className="btn ink" href="/circles">
            Dây của tôi
          </Link>
          <Link className="btn ghost" href="/">
            Về trang chủ
          </Link>
        </div>
      </div>
    </main>
  );
}
