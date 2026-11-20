import { expect, test, type Page } from '@playwright/test';
import { noClippedContent, noHorizontalOverflow, tableOrCards, toast, watchErrors } from './helpers';

/** Every page added in B8. Each one must load clean, fit the screen, and answer every control. */
const PAGES = [
  '/dang-nhap',
  '/moi/dang-gom',
  '/circles/demo',
  '/circles/co-dinh',
  '/circles/dang-gom',
  '/circles/da-xong',
  ...['demo', 'co-dinh', 'dang-gom', 'da-xong'].flatMap((id) => ['ket-qua', 'thieu', 'bao-chung', 'giu-lai', 'so-ho', 'tat-toan'].map((s) => `/circles/${id}/${s}`)),
  '/cai-dat',
  '/thong-bao-ubnd',
  '/lab',
];

test.describe('B8 pages load clean at every width', () => {
  for (const path of PAGES) {
    test(`${path}: one h1, no overflow, no console errors, duplicate ids none`, async ({ page }) => {
      const errs = watchErrors(page);
      await page.goto(path);
      await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
      await noHorizontalOverflow(page);
      await noClippedContent(page);
      const dup = await page.evaluate(() => {
        const ids = [...document.querySelectorAll('[id]')].map((e) => e.id);
        return ids.filter((id, i) => ids.indexOf(id) !== i);
      });
      expect(dup).toEqual([]);
      errs.expectClean();
    });
  }
});

test.describe('S01 /dang-nhap', () => {
  test('three ways in, each says it is not wired yet; link back from an invite', async ({ page }) => {
    await page.goto('/dang-nhap?tiep=/moi/dang-gom');
    await page.getByRole('button', { name: 'Tiếp tục với Google' }).click();
    await expect(toast(page, 'Đăng nhập bằng Google')).toBeVisible();
    await page.getByRole('button', { name: 'Tiếp tục với email' }).click();
    await expect(toast(page, 'Đăng nhập bằng email')).toBeVisible();
    await page.getByRole('button', { name: 'Tiếp tục với số điện thoại' }).click();
    await expect(toast(page, 'OTP số điện thoại')).toBeVisible();
    await expect(page.getByText('Không cần ví, không cần AVAX')).toBeVisible();
    await page.getByRole('link', { name: 'Quay lại trang mời' }).click();
    await expect(page).toHaveURL(/\/moi\/dang-gom$/);
  });
});

test.describe('S05 /moi/dang-gom', () => {
  test('summary, organizer badge, risk table, agreement with its hash; "Vào dây" needs the box', async ({ page }) => {
    await page.goto('/moi/dang-gom');
    await expect(page.getByText('Còn 2 chỗ').first()).toBeVisible();
    await expect(page.getByText('Chủ hụi 0x7e…2b')).toBeVisible();
    await expect(page.getByText('Huy hiệu là lịch sử, không phải bảo đảm. Bảo đảm của bạn là cọc của chủ hụi.').first()).toBeVisible();
    await expect(tableOrCards(page, /Số tiền tối đa mỗi chỗ/)).toBeVisible();
    await expect(page.getByTestId('agreement-hash')).toHaveText(/^0x[0-9a-f]{64}$/);
    await page.getByText('Đọc toàn văn thỏa thuận').click();
    await expect(page.getByText('Chủ hụi không giữ tiền, nhưng ký quỹ bảo lãnh.')).toBeVisible();
    await expect(page.getByText('Hoa hồng chủ hụi nằm trong trần lãi: 50% quỹ lãi tối đa của kỳ')).toBeVisible();

    await page.getByRole('button', { name: 'Vào dây' }).click();
    await expect(toast(page, 'đủ 18 tuổi và đồng ý luật dây')).toBeVisible();
    await expect(page.getByRole('checkbox', { name: /đủ 18 tuổi và đồng ý/ })).toBeFocused();
    await page.getByRole('checkbox', { name: /đủ 18 tuổi và đồng ý/ }).click();
    await page.getByRole('button', { name: 'Vào dây' }).click();
    await expect(page).toHaveURL(/\/dang-nhap\?tiep=\/moi\/dang-gom$/);
  });
  test('only the sample forming circle has an invite page', async ({ page }) => {
    expect((await page.goto('/moi/khong-co'))?.status()).toBe(404);
  });
});

test.describe('S04 forming circle', () => {
  test('QR + link, members with badges, bond numbers, start stays closed until full', async ({ page }) => {
    await page.goto('/circles/dang-gom');
    await expect(page.getByRole('img', { name: /Mã QR của đường dẫn mời/ })).toBeVisible();
    await expect(page.getByTestId('invite-url')).toContainText('/moi/dang-gom');
    await expect(page.getByRole('list').filter({ hasText: 'Chỗ trống' }).getByRole('listitem')).toHaveCount(5);
    await expect(page.getByText('Bậc Tin cậy').first()).toBeVisible();
    await expect(page.getByText('Ký quỹ đã khóa')).toBeVisible();
    await expect(page.getByText('Chỉ số bảo chứng').first()).toBeVisible();
    const start = page.getByRole('button', { name: 'Bắt đầu dây' });
    await expect(start).toHaveAttribute('aria-disabled', 'true');
    await page.getByRole('switch', { name: /Xem thử khi đã đủ 5 người/ }).click();
    await expect(page.getByRole('heading', { name: 'Đang chờ đủ người: 5 trên 5' })).toBeVisible();
    // full circle: no longer tells the organizer to keep inviting (issue found 20/11 on Fuji)
    await expect(page.getByText(/để mời đủ người/)).toHaveCount(0);
    await expect(page.getByText(/Đã đủ 5 người\. Còn .* để bấm "Bắt đầu dây"/)).toBeVisible();
    await expect(start).toHaveAttribute('aria-disabled', 'false');
    await start.click();
    await expect(toast(page, 'Bắt đầu dây cần đăng nhập')).toBeVisible();
    await page.getByRole('button', { name: 'Nạp thêm ký quỹ' }).click();
    await expect(toast(page, 'Nạp thêm ký quỹ cần đăng nhập')).toBeVisible();
    await page.getByRole('link', { name: 'Xem trang mời' }).click();
    await expect(page).toHaveURL(/\/moi\/dang-gom$/);
  });
});

test.describe('circle sections', () => {
  test('a settled round links to its result and to the shortfall page; the chips open coverage and holdback', async ({ page, isMobile }) => {
    await page.goto('/circles/demo');
    if (isMobile) await page.getByRole('button', { name: 'Kỳ trước' }).click();
    else await page.locator('.rail button').nth(1).click();
    await page.locator('.receipt').getByRole('link', { name: 'Chi tiết kỳ 2' }).click();
    await expect(page).toHaveURL(/\/circles\/demo\/ket-qua$/);
    await page.goBack();
    if (isMobile) await page.getByRole('button', { name: 'Kỳ trước' }).click();
    else await page.locator('.rail button').nth(1).click();
    await page.locator('.receipt').getByRole('link', { name: 'Khoản thiếu' }).click();
    await expect(page).toHaveURL(/\/circles\/demo\/thieu$/);
    await page.goto('/circles/demo');
    await page.locator('#hs-health a.chip').first().click();
    await expect(page).toHaveURL(/\/circles\/demo\/bao-chung$/);
  });

  test('S07 result: docs/03 numbers for kỳ 1 and kỳ 2, the sum line checks out', async ({ page }) => {
    await page.goto('/circles/demo/ket-qua');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Kết quả kỳ 2');
    await expect(page.getByText('Kiểm:').first()).toContainText('323,18 USDC');
    await expect(page.getByText('Khớp.')).toBeVisible();
    await expect(page.getByText('Thiếu 100 USDC')).toBeVisible();
    await page.getByRole('radio', { name: 'Kỳ 1' }).click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Kết quả kỳ 1');
    await expect(page.getByText('Kiểm:').first()).toContainText('288,48 USDC');
    await expect(page.getByRole('heading', { name: 'Thành viên 4 hốt kỳ này' })).toBeVisible();
    await expect(page.getByText('Kỳ 3 đang diễn ra nên chưa có kết quả')).toBeVisible();
    await page.getByRole('button', { name: 'Chốt kỳ 3' }).click();
    await expect(toast(page, 'Chốt kỳ 3 cần nối mạng')).toBeVisible();
    await page.getByRole('button', { name: 'Xem giao dịch trên Snowtrace' }).click();
    await expect(toast(page, 'chưa có giao dịch thật')).toBeVisible();
  });

  test('S07 result: the receiver sees "Nhận tiền" when the transfer was blocked', async ({ page }) => {
    await page.goto('/circles/da-xong/ket-qua');
    await page.getByRole('radio', { name: 'Kỳ 5' }).click();
    await expect(page.getByRole('heading', { name: 'Bạn hốt kỳ này' })).toBeVisible();
    await page.getByRole('switch', { name: /chuyển tiền cho tôi bị chặn/ }).click();
    await expect(page.getByText('chờ bạn nhận')).toBeVisible();
    await page.getByRole('button', { name: 'Nhận tiền' }).click();
    await expect(page.getByText(/^Đã nhận .* USDC \(mẫu\)\.$/)).toBeVisible();
  });

  test('S07 empty: a forming circle has no result yet and says why', async ({ page }) => {
    await page.goto('/circles/dang-gom/ket-qua');
    await expect(page.getByRole('heading', { name: 'Chưa có kỳ nào được chi' })).toBeVisible();
  });

  test('S08 shortfall: as the debtor there is a red banner with interest running, and "Trả ngay" resolves it', async ({ page }) => {
    await page.goto('/circles/co-dinh/thieu');
    const banner = page.locator('section[role="alert"]');
    await expect(banner).toContainText('Bạn còn thiếu 20 USDC kỳ 2');
    await expect(banner).toContainText('Hạn trả:');
    await expect(banner).toContainText('Lãi chậm góp đang cộng (10%/năm)');
    await banner.getByRole('button', { name: /^Trả ngay/ }).click();
    await expect(page.getByRole('heading', { name: 'Đã trả trễ, không bị vỡ nợ' })).toBeVisible();
    await expect(page.getByText('Hoàn ký quỹ của chủ hụi')).toBeVisible();
    await expect(page.locator('section[role="alert"]')).toHaveCount(0);
    await expect(page.getByText('Đã trả trễ', { exact: true }).first()).toBeVisible();
  });

  test('S08 shortfall: as another member, then as the debtor in the grace period (demo)', async ({ page }) => {
    await page.goto('/circles/demo/thieu');
    await expect(page.locator('section[role="alert"]')).toHaveCount(0);
    await expect(page.getByText('Kỳ 2: Thành viên 4 thiếu 100 USDC')).toBeVisible();
    await expect(page.getByText(/80 USDC từ tiền giữ lại.*20 USDC từ ký quỹ/)).toBeVisible();
    await expect(page.getByText('vẫn nhận đủ 323,18 USDC')).toBeVisible();
    await page.getByRole('radio', { name: /Thành viên 4 \(người thiếu/ }).click();
    await expect(page.locator('section[role="alert"]')).toContainText('Bạn còn thiếu 100 USDC kỳ 2');
    await page.getByRole('button', { name: /^Trả ngay/ }).click();
    await expect(toast(page, 'Đã trả trễ (mẫu)')).toBeVisible();
    await expect(page.getByText('Trả lại tiền giữ lại của bạn')).toBeVisible();
  });

  test('S08 shortfall: a circle with no shortfall says so', async ({ page }) => {
    await page.goto('/circles/da-xong/thieu');
    await expect(page.getByRole('heading', { name: 'Chưa có khoản thiếu nào' })).toBeVisible();
  });

  test('S09 coverage: bond 460 now, cascade 80 + 20, and the branch B projection 460, 360, 260, 160', async ({ page }) => {
    await page.goto('/circles/demo/bao-chung');
    await expect(page.getByRole('heading', { name: /Ký quỹ còn 460 USDC trên 480 USDC/ })).toBeVisible();
    const fig = page.locator('figure').filter({ hasText: 'Kỳ 2: Thành viên 4 thiếu 100 USDC' });
    await expect(fig).toContainText('1. Tiền giữ lại');
    await expect(fig).toContainText('80 USDC');
    await expect(fig).toContainText('2. Ký quỹ chủ hụi');
    const proj = page.getByRole('table', { name: /Ký quỹ còn lại sau từng kỳ/ });
    const cells = await proj.locator('tbody tr td:nth-child(3)').allTextContents();
    expect(cells).toEqual(['480 USDC', '460 USDC', '360 USDC', '260 USDC', '160 USDC']);
    await expect(page.getByText('Tiền công kỳ 2 (3,91 USDC) chuyển vào quỹ dự phòng')).toBeVisible();
    await expect(page.getByText('Không có. Mọi khoản thiếu đã được bù đủ.')).toBeVisible();
    await expect(tableOrCards(page, /Số tiền tối đa mỗi chỗ/)).toContainText('304 USDC');
  });

  test('S10 holdback: schedule for a seat the viewer has not taken yet, and for one already taken', async ({ page }) => {
    await page.goto('/circles/demo/giu-lai');
    await expect(page.getByRole('heading', { name: 'Nếu hốt kỳ 3: giữ 40 USDC' })).toBeVisible();
    await page.getByRole('radio', { name: 'Kỳ 4' }).click();
    await expect(page.getByRole('heading', { name: 'Nếu hốt kỳ 4: giữ 20 USDC' })).toBeVisible();
    await expect(page.getByText('Thành viên 1').first()).toBeVisible();
    await page.goto('/circles/co-dinh/giu-lai');
    await expect(page.getByRole('heading', { name: /Nếu hốt kỳ 3: giữ 8 USDC/ })).toBeVisible();
    await page.goto('/circles/da-xong/giu-lai');
    await expect(page.getByRole('heading', { name: /Bạn hốt kỳ 5: giữ 30 USDC/ })).toBeVisible();
    await expect(page.getByText('Đã nhả').first()).toBeVisible();
  });

  test('S11 book: round filter narrows the rows, JSON downloads, print resets the filter', async ({ page }) => {
    await page.goto('/circles/demo/so-ho?ban=day-du');
    const status = page.getByRole('status').filter({ hasText: /Đang hiện/ });
    const total = await status.textContent();
    await page.getByRole('radio', { name: 'Kỳ 1' }).click();
    const one = await status.textContent();
    expect(one).not.toBe(total);
    await expect(page.getByRole('table', { name: 'Các dòng sổ hụi' }).locator('tbody tr td:nth-child(2)')).toHaveText(['1', '1', '1', '1', '1']);
    await page.getByRole('radio', { name: 'Tất cả' }).click();
    const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Tải JSON' }).click()]);
    expect(dl.suggestedFilename()).toBe('so-ho-demo.json');
    await page.evaluate(() => {
      window.print = () => {};
    });
    await page.getByRole('radio', { name: 'Kỳ 1' }).click();
    await page.getByRole('button', { name: 'In sổ hụi' }).click();
    await expect(page.getByRole('radio', { name: 'Tất cả' })).toBeChecked(); // a printed book has every line
    await expect(page.getByRole('cell', { name: /Vỡ nợ/ })).toBeVisible();
  });

  test('S12 settlement: net, interest received and paid, reserve reward, then "Nhận tiền"', async ({ page }) => {
    await page.goto('/circles/da-xong/tat-toan');
    await expect(page.getByRole('heading', { level: 2 }).first()).toContainText(/Bạn (lời|trả) ròng/);
    await expect(page.getByText('Lãi thăm đã nhận', { exact: false }).first()).toBeVisible();
    await expect(page.getByText('Lãi thăm đã trả (khi hốt)')).toBeVisible();
    await expect(page.getByText('Tiền công đã trả ngay lúc chi kỳ')).toBeVisible();
    await expect(page.getByText('Tiền công trả khi kết thúc dây')).toBeVisible();
    await expect(page.getByText('Thưởng đúng hạn từ quỹ dự phòng')).toBeVisible();
    // 8 members: a header row and 8 rows in the table (wide screens), 8 cards below 1024px
    if ((page.viewportSize()?.width ?? 1440) >= 1024) await expect(page.getByRole('table', { name: /Tất toán của từng thành viên/ }).getByRole('row')).toHaveCount(9);
    else await expect(page.getByRole('list', { name: /Tất toán của từng thành viên/ }).getByRole('listitem')).toHaveCount(8);
    await page.getByRole('button', { name: /^Nhận tiền/ }).click();
    await expect(page.getByText(/^Đã nhận .* USDC \(mẫu\)\.$/)).toBeVisible();
  });

  test('S12 settlement: a running circle points to the finished one', async ({ page }) => {
    await page.goto('/circles/demo/tat-toan');
    await expect(page.getByRole('heading', { name: 'Dây này chưa kết thúc' })).toBeVisible();
    await page.getByRole('link', { name: /dây Hụi chị em văn phòng đã kết thúc/ }).click();
    await expect(page).toHaveURL(/\/circles\/da-xong\/tat-toan$/);
  });

  test('Fixed circle runs end to end: room, pay, result, full book', async ({ page }) => {
    await page.goto('/circles/co-dinh');
    await expect(page.getByRole('heading', { name: 'Kỳ này bạn hốt.' })).toBeVisible();
    await expect(page.getByRole('button', { name: /Niêm phong/ })).toHaveCount(0); // no sealed bid in a Fixed circle
    await page.getByRole('link', { name: 'Trả khoản thiếu 20,00 USDC' }).click();
    await expect(page).toHaveURL(/\/circles\/co-dinh\/thieu$/);
    await page.goto('/circles/co-dinh/ket-qua');
    await expect(page.getByRole('heading', { name: 'Thành viên 2 hốt kỳ này' })).toBeVisible();
    await expect(page.getByText('theo thứ tự đã định').first()).toBeVisible();
    await page.goto('/circles/co-dinh/so-ho?ban=day-du');
    await expect(page.getByRole('table', { name: 'Các dòng sổ hụi' })).toBeVisible();
  });
});

test.describe('09/11 decisions in the screens', () => {
  test('reputation: every member line says its tier in words, and the unpaid default is flagged', async ({ page, isMobile }) => {
    await page.goto('/circles/demo');
    let people = page.locator('.panel.side');
    if (isMobile) {
      await page.locator('.peek').click();
      people = page.getByRole('dialog');
    }
    await expect(people).toContainText('Bậc Lâu năm');
    await expect(people).toContainText('Bậc Tin cậy');
    await expect(people).toContainText('có nợ chưa trả'); // Thành viên 4 defaulted and has not repaid
  });


});

test.describe('S13 assistant drawer', () => {
  const answer = (extra = '') =>
    [
      '{"type":"status","text":"Đang tính ký quỹ..."}',
      '{"type":"tool","name":"recommend_bond","result":{"maxExposure":"600","bond":"480","guaranteedCoverageBps":10000,"guaranteedCoveragePercent":"100"}}',
      `{"type":"answer","answer":{"answer":"Bạn cần ký quỹ 480 USDC để bảo chứng 100%.${extra} Đây là thông tin tham khảo, không phải tư vấn tài chính hay pháp lý.","refused":false},"source":"model","label":"Số liệu do hàm tính của HụiSafe tạo; lời giải thích do AI viết."}`,
    ].join('\n') + '\n';

  async function open(page: Page) {
    await page.getByRole('button', { name: 'Trợ lý', exact: true }).click();
    const dlg = page.getByRole('dialog', { name: 'Trợ lý AI cho chủ hụi' });
    await expect(dlg).toBeVisible();
    return dlg;
  }

  test('suggested question streams an answer with the tool numbers beside it; Esc closes', async ({ page }) => {
    await page.route('**/api/copilot', (r) => r.fulfill({ status: 200, contentType: 'application/x-ndjson', body: answer() }));
    await page.goto('/circles');
    const dlg = await open(page);
    await expect(dlg).toContainText('Chỉ đọc và tính, không ký, không chuyển tiền');
    await dlg.getByRole('button', { name: 'Ký quỹ bao nhiêu để bảo chứng 100%?' }).click();
    await expect(dlg.getByText('Bạn cần ký quỹ 480 USDC để bảo chứng 100%.')).toBeVisible();
    await expect(dlg.getByText('Số liệu do hàm tính của HụiSafe tạo; lời giải thích do AI viết.', { exact: true })).toBeVisible();
    await expect(dlg.getByText('Ký quỹ cần')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(dlg).toHaveCount(0);
  });

  test('the request carries the form draft and no wallet address', async ({ page }) => {
    let body = '';
    await page.route('**/api/copilot', (r) => {
      body = r.request().postData() ?? '';
      return r.fulfill({ status: 200, contentType: 'application/x-ndjson', body: answer() });
    });
    await page.goto('/circles/new');
    await page.getByRole('button', { name: 'Tiếp tục ›' }).click();
    for (let i = 0; i < 3; i++) await page.getByRole('button', { name: 'Thêm một người' }).click();
    const dlg = await open(page);
    await dlg.getByLabel('Câu hỏi cho trợ lý').fill('Rủi ro thế nào?');
    await dlg.getByRole('button', { name: 'Gửi câu hỏi' }).click();
    await expect(dlg.getByText('Bạn cần ký quỹ 480 USDC')).toBeVisible();
    const sent = JSON.parse(body) as { draft?: { N: number }; messages: { role: string }[] };
    expect(sent.draft?.N).toBe(8);
    expect(sent.messages.at(-1)?.role).toBe('user');
    expect(body).not.toMatch(/0x[0-9a-fA-F]{40}/);
  });

  test('when the route is not configured the Vietnamese config error is shown and the calculator still works', async ({ page }) => {
    await page.route('**/api/copilot', (r) =>
      r.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: { code: 'not_configured', message: 'Trợ lý AI chưa được cấu hình: thiếu COPILOT_MODEL. Bạn dùng chế độ máy tính.' } }) }),
    );
    await page.goto('/circles');
    const dlg = await open(page);
    await dlg.getByLabel('Câu hỏi cho trợ lý').fill('Xin chào');
    await dlg.getByRole('button', { name: 'Gửi câu hỏi' }).click();
    await expect(dlg.getByText('Trợ lý AI chưa được cấu hình: thiếu COPILOT_MODEL.')).toBeVisible();
    await dlg.getByRole('radio', { name: 'Máy tính' }).click();
    await expect(dlg.getByText('Ký quỹ để bảo chứng 100%')).toBeVisible();
    await expect(dlg.getByText('480 USDC').first()).toBeVisible();
    await dlg.getByLabel('Số người').fill('10');
    await expect(dlg.getByText('2.000 USDC').first()).toBeVisible(); // 10 x 100: peak risk 2.500, bond for 100% = 0,8 x 2.500
  });

  test('no route at all (network down): says so instead of hanging, and offers inline retry + calculator', async ({ page }) => {
    let attempts = 0;
    await page.route('**/api/copilot', (r) => {
      attempts++;
      if (attempts <= 3) return r.abort();
      return r.fulfill({ status: 200, contentType: 'application/x-ndjson', body: answer() });
    });
    await page.goto('/circles');
    const dlg = await open(page);
    await dlg.getByLabel('Câu hỏi cho trợ lý').fill('Xin chào');
    await dlg.getByLabel('Câu hỏi cho trợ lý').press('Enter'); // Enter sends directly
    await expect(dlg.getByText('Không kết nối được trợ lý')).toBeVisible({ timeout: 8000 });
    expect(attempts).toBe(3); // 1 initial + 2 automatic retries
    await expect(dlg.getByRole('button', { name: 'Gửi câu hỏi' })).toBeDisabled(); // empty box again
    if (!page.viewportSize() || page.viewportSize()!.width >= 768) {
      const ty = await dlg.evaluate((el) => getComputedStyle(el).getPropertyValue('--tw-enter-translate-y').trim());
      expect(ty === '' || ty === '0' || ty === '0px').toBe(true);
    }
    // Inline retry recovers without duplicating the user bubble.
    await dlg.getByRole('button', { name: 'Thử lại' }).click();
    await expect(dlg.getByText('Bạn cần ký quỹ 480 USDC để bảo chứng 100%.')).toBeVisible();
    await expect(dlg.getByRole('list', { name: 'Cuộc trò chuyện' }).getByRole('listitem')).toHaveCount(2);
  });

  test('recovers transparently when a single transient network change aborts the first stream', async ({ page }) => {
    let calls = 0;
    await page.route('**/api/copilot', (r) => {
      calls++;
      return calls === 1 ? r.abort('internetdisconnected') : r.fulfill({ status: 200, contentType: 'application/x-ndjson', body: answer() });
    });
    await page.goto('/circles');
    const dlg = await open(page);
    await dlg.getByLabel('Câu hỏi cho trợ lý').fill('hello /');
    await dlg.getByRole('button', { name: 'Gửi câu hỏi' }).click();
    await expect(dlg.getByText('Bạn cần ký quỹ 480 USDC để bảo chứng 100%.')).toBeVisible();
    expect(calls).toBe(2);
  });
});

test.describe('S14 settings', () => {
  test('"Chữ lớn" makes the text 22px and survives a reload', async ({ page }) => {
    await page.goto('/cai-dat');
    await page.getByRole('radio', { name: 'Chữ lớn' }).click();
    await expect.poll(() => page.evaluate(() => document.documentElement.style.fontSize)).toBe('22px');
    await expect(page.getByText(/Câu mẫu: thăm cao nhất/)).toHaveCSS('font-size', '22px');
    await page.reload();
    await expect.poll(() => page.evaluate(() => document.documentElement.style.fontSize)).toBe('22px');
    await expect(page.getByText(/Câu mẫu: thăm cao nhất/)).toHaveCSS('font-size', '22px');
    await expect(page.getByRole('radio', { name: 'Chữ lớn' })).toBeChecked();
    await noHorizontalOverflow(page);
    await page.getByRole('radio', { name: 'Chữ thường' }).click();
    await expect.poll(() => page.evaluate(() => document.documentElement.style.fontSize)).toBe('');
    await expect(page.getByText(/Câu mẫu: thăm cao nhất/)).toHaveCSS('font-size', '15px');
  });

  test('backup buttons and the reminder switch each answer', async ({ page }) => {
    await page.goto('/cai-dat');
    await page.getByRole('button', { name: 'Sao lưu thăm' }).click();
    await expect(toast(page, 'mật khẩu dài ít nhất 8 ký tự')).toBeVisible();
    await page.getByLabel('Mật khẩu để mã hóa file sao lưu').fill('mat-khau-dai');
    await page.getByRole('button', { name: 'Sao lưu thăm' }).click();
    await expect(toast(page, 'Chưa có thăm niêm phong nào')).toBeVisible();
    await page.getByRole('button', { name: 'Nhập file sao lưu' }).click();
    await expect(toast(page, 'Nhập file sao lưu để mở thăm')).toBeVisible();
    await page.getByText('Bật nhắc hụi').click();
    await expect(toast(page, 'Nhắc hụi qua Telegram cần đăng nhập')).toBeVisible();
    await expect(page.getByText('Bậc Tin cậy').or(page.getByText('Bậc Mới')).first()).toBeVisible();
  });
});

test.describe('S15 UBND notice', () => {
  test('typed details fill the draft on this device only; empty slots stay marked', async ({ page }) => {
    let sent = false;
    page.on('request', (r) => {
      if (r.method() === 'POST') sent = true;
    });
    await page.goto('/thong-bao-ubnd');
    const draft = page.getByTestId('ubnd-draft');
    await expect(page.getByRole('status').filter({ hasText: 'Còn 5 ô chưa điền' })).toBeVisible();
    await page.getByLabel('Họ và tên').fill('Nguyễn Văn A');
    await expect(draft).toContainText('Họ và tên: Nguyễn Văn A');
    await expect(page.getByRole('status').filter({ hasText: 'Còn 4 ô chưa điền' })).toBeVisible();
    await expect(draft.locator('mark')).toHaveCount(4);
    await page.getByRole('button', { name: 'Sao chép bản nháp' }).click();
    await expect(toast(page, /Đã sao chép bản nháp|Máy không cho sao chép/)).toBeVisible();
    expect(sent).toBe(false);
  });
});

test.describe('S16 /lab', () => {
  test('charts for three designs, the assumptions stated first, and the scenario switch', async ({ page }) => {
    await page.goto('/lab');
    await expect(page.getByRole('heading', { name: 'Giả định của lần chạy này' })).toBeVisible();
    await expect(page.getByText('là giả định lấy cảm hứng từ nghiên cứu Klonner & Rai (2008), không phải số đo thật')).toBeVisible();
    await expect(page.getByRole('figure')).toHaveCount(3);
    for (const name of ['Hụi truyền thống', 'Trên mạng, không bảo chứng', 'HụiSafe']) await expect(page.getByRole('figure').first()).toContainText(name);
    const before = await page.getByRole('figure').first().textContent();
    await page.getByRole('radio', { name: 'Kịch bản đã hiệu chỉnh' }).click();
    await expect(page.getByRole('figure').first()).not.toHaveText(before ?? '');
    await expect(tableOrCards(page, /Tỷ lệ dây còn khoản chưa bù được/)).toBeVisible();
  });
});

test.describe('the top bar reaches the other pages', () => {
  test('login link and assistant button are in the top bar; settings lists the tools', async ({ page }) => {
    await page.goto('/circles');
    await page.getByRole('banner').getByRole('link', { name: 'Đăng nhập' }).click();
    await expect(page).toHaveURL(/\/dang-nhap$/);
    await expect(page.getByRole('banner').getByRole('button', { name: 'Trợ lý', exact: true })).toBeVisible();
    for (const [label, url] of [['Phòng mô phỏng', /\/lab$/], ['Thông báo UBND', /\/thong-bao-ubnd$/], ['Trang giới thiệu', /\/$/]] as const) {
      await page.goto('/cai-dat');
      await page.getByRole('list', { name: 'Công cụ khác' }).getByRole('link', { name: label }).click();
      await expect(page).toHaveURL(url);
    }
  });
});
