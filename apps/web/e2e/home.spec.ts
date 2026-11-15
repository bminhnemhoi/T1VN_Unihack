import { expect, test, type Page } from '@playwright/test';
import { FUJI_EVIDENCE } from 'config';
import { noHorizontalOverflow, watchErrors } from './helpers';

/** Most checks run with reduced motion: the page must be complete and correct without any animation. */
async function openStill(page: Page) {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
}

test.describe('S01 / landing', () => {
  test('has its own navigation, no app header or bottom bar, and the DEMO chip', async ({ page }) => {
    const errs = watchErrors(page);
    await openStill(page);
    await expect(page.getByRole('navigation', { name: 'Trang giới thiệu' })).toBeVisible();
    await expect(page.getByRole('navigation', { name: /^Điều hướng chính/ })).toHaveCount(0);
    await expect(page.getByRole('banner')).toHaveCount(0);
    await expect(page.getByTestId('demo-chip')).toBeVisible();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(/Chơi hụi\s+không sợ\s+giựt\./);
    await noHorizontalOverflow(page);
    errs.expectClean();
  });

  for (const name of ['Mở app', 'Chơi hụi ngay', 'Mở HụiSafe']) {
    test(`"${name}" opens the web app`, async ({ page }) => {
      await openStill(page);
      await page.getByRole('link', { name }).click();
      await expect(page).toHaveURL(/\/circles$/);
      // Back in the app, its own chrome is there again.
      await expect(page.getByRole('navigation', { name: /^Điều hướng chính/ }).first()).toBeAttached();
    });
  }

  test('footer links reach the main screens', async ({ page }) => {
    const footer = page.getByRole('navigation', { name: 'Vào web app' });
    for (const [label, url] of [['Dây của tôi', /\/circles$/], ['Tạo dây', /\/circles\/new$/], ['Phòng mô phỏng', /\/lab$/], ['Đăng nhập', /\/dang-nhap$/]] as const) {
      await openStill(page);
      await footer.getByRole('link', { name: label }).click();
      await expect(page).toHaveURL(url);
    }
  });

  test('bid card follows docs/03 section 8: bid 6 pays 288,48, above 6,575342 is refused', async ({ page }) => {
    await openStill(page);
    const bid = page.getByLabel(/Thăm kỳ 1/);
    await expect(page.getByTestId('lp-payout')).toHaveText('288,48');
    await bid.fill('7');
    await expect(page.getByText('Vượt trần 6,575342 USDC: smart contract không cho mở thăm này.')).toBeVisible();
    await expect(page.getByTestId('lp-payout')).toHaveCount(0);
    await bid.fill('6,575342');
    await expect(page.getByText(/Hợp lệ\. Mỗi người còn lại bớt 6,575342 USDC\./)).toBeVisible();
  });

  test('cascade card: M4 defaults, 80 from holdback + 20 from bond, M1 still gets 323,18', async ({ page }) => {
    await openStill(page);
    const out = page.getByTestId('lp-cascade');
    await expect(out).toHaveText('Pot 391 USDC. M1 nhận ngay 323,18 USDC.');
    await page.getByRole('button', { name: 'M4 bỏ đóng' }).click();
    await expect(page.getByRole('button', { name: 'M4 bỏ đóng' })).toHaveAttribute('aria-pressed', 'true');
    await expect(out).toHaveText('M4 thiếu 100: bù 80 từ tiền giữ lại của M4, 20 từ ký quỹ (còn 460). M1 vẫn nhận 323,18 USDC.');
  });

  test('coverage card: 480 on 5 members is 100%, less cannot start on Fuji', async ({ page }) => {
    await openStill(page);
    const out = page.getByTestId('lp-coverage');
    await expect(out).toHaveText('Bảo chứng 100%: đủ, được bắt đầu dây');
    const bond = page.getByRole('slider', { name: /Ký quỹ/ });
    await bond.focus();
    await bond.press('Home');
    await expect(out).toHaveText('Bảo chứng 20%: dưới 100%, không bắt đầu được dây');
    await bond.press('End');
    await expect(out).toHaveText('Bảo chứng 100%: đủ, được bắt đầu dây');
  });

  test('ledger links open the two real circles on the Fuji explorer', async ({ page }) => {
    await openStill(page);
    for (const address of Object.values(FUJI_EVIDENCE)) {
      const link = page.locator(`a[href="https://testnet.snowtrace.io/address/${address}"]`);
      await expect(link).toHaveCount(1);
      await expect(link).toHaveAttribute('target', '_blank');
      await expect(link).toHaveAttribute('rel', /noopener/);
    }
  });

  test('B23 hero: the new wording, the sign-in note under the buttons, and no question chips in the hero', async ({ page }) => {
    await openStill(page);
    const hero = page.locator('[data-lp-hero]');
    await expect(hero).toContainText('Testnet Hụi bỏ thăm chạy bằng smart contract trên Avalanche');
    await expect(hero).toContainText('HụiSafe đưa luật của một dây hụi vào smart contract trên blockchain Avalanche.');
    await expect(hero).toContainText('Ai bỏ đóng, hợp đồng lấy ký quỹ bù ngay, không cần ai đồng ý.');
    await expect(hero).toContainText('Đăng nhập bằng Google hoặc email. Không cần ví crypto, không cần AVAX.');
    await expect(hero.getByRole('list', { name: /câu người chơi hụi hay hỏi/ })).toHaveCount(0);
    await expect(hero.getByRole('list', { name: 'Chọn một tình huống để xem' })).toHaveCount(0);
  });

  test('B23 one kỳ: label, title and the three steps in the brief\'s words', async ({ page }) => {
    await openStill(page);
    const story = page.locator('[data-lp-story]');
    await expect(story.getByRole('heading', { level: 2 })).toHaveText('Một kỳ hụi chạy thế nào on-chain');
    await expect(story).toContainText('Một kỳ hụi trên blockchain');
    await expect(story).toContainText('Cuộn xuống để xem kỳ 2 của dây mẫu Tổ dân phố 7, từ lúc nộp thăm tới lúc chi tiền.');
    await expect(story.getByRole('heading', { level: 3 })).toHaveText(['Bạn ghi số tiền muốn bớt, rồi niêm phong.', 'Hết giờ nộp, mọi người mở thăm.', 'Gom tiền và chi trong cùng một giao dịch.']);
    await expect(story).toContainText('rồi băm thành một hash (keccak256). On-chain chỉ có hash đó.');
    await expect(story).toContainText('Không bốc thăm, không ai chọn hộ.');
    await expect(story).toContainText('Sau giao dịch, hợp đồng chỉ còn giữ ký quỹ, tiền giữ lại và quỹ dự phòng.');
  });

  test('B23 situations: five index chips jump to their cards, the cards carry the new labels and words', async ({ page }) => {
    await openStill(page);
    const section = page.locator('#tinh-huong');
    await expect(section.getByRole('heading', { level: 2 })).toHaveText('Gặp chuyện thì smart contract xử lý ra sao');
    const chips = section.getByRole('list', { name: 'Chọn một tình huống để xem' }).getByRole('link');
    await expect(chips).toHaveText(['Muốn hốt sớm?', 'Có người hốt rồi bỏ đóng?', 'Dây có an toàn không?', 'Lỡ trễ một kỳ?', 'Chủ hụi gian lận được không?']);
    for (const [i, id] of ['th-hot-som', 'th-bo-dong', 'th-an-toan', 'th-tre-ky', 'th-chu-hui'].entries()) {
      await expect(chips.nth(i)).toHaveAttribute('href', `#${id}`);
      await expect(page.locator(`#${id}`)).toHaveCount(1);
    }
    for (const label of ['Khi bỏ thăm', 'Khi có người bỏ đóng', 'Trước khi vào dây', 'Khi lỡ trễ', 'Khi nghi chủ hụi']) await expect(section.getByText(label, { exact: true })).toBeVisible();
    await expect(section.getByText('Bạn,', { exact: false })).toHaveCount(0);
    await expect(section).toContainText('M4 hốt rồi bỏ đóng?');
    await expect(section).toContainText('Dưới 100%, hợp đồng không cho bắt đầu dây.');
    await expect(section).toContainText('Bạn có 48 giờ ân hạn để đóng bù kèm lãi chậm góp (bản demo: 2 phút).');
    // The commitment of docs/03 section 7.3, word for word.
    await expect(section).toContainText('Cọc 100% chặn được chủ hụi dùng một ví ảo: làm vậy chủ hụi tự lỗ. Dùng nhiều ví ảo thì bị chặn bằng xác thực mỗi người một tài khoản, và mọi người thấy trước rủi ro tối đa của mình.');
    await chips.nth(3).click();
    await expect(page).toHaveURL(/#th-tre-ky$/);
    await expect(page.locator('#th-tre-ky')).toBeInViewport();
  });

  test('B23 technology: six cards, a nav link, the contest line (no factory link without a deployment)', async ({ page }) => {
    await openStill(page);
    await expect(page.getByRole('navigation', { name: 'Trang giới thiệu' }).locator('a[href="#cong-nghe"]')).toHaveText('Công nghệ'); // the link row is hidden on phones
    const tech = page.locator('#cong-nghe');
    await expect(tech.getByRole('heading', { level: 2 })).toHaveText('Công nghệ phía sau HụiSafe');
    await expect(tech.getByRole('heading', { level: 3 })).toHaveText([
      'Smart contract trên Avalanche C-Chain',
      'Tiền góp bằng USDC',
      'Đăng nhập không cần ví crypto',
      'Thăm kín bằng commit-reveal',
      'Kiểm thử và kiểm toán (audit)',
      'Trợ lý AI chỉ tính, không ký',
    ]);
    await expect(tech).toContainText('632 bài test Foundry, trong đó 54 invariant về tiền (điều kiện về tiền luôn phải đúng) được kiểm bằng fuzz test.');
    // B24: a text partner strip under the title (names only, no logos) and one "why we chose it" line per card.
    await expect(tech.getByRole('list', { name: 'Công nghệ và đối tác' }).getByRole('listitem')).toHaveText(['Avalanche', 'Circle USDC', 'Privy', 'OpenZeppelin', 'Foundry']);
    await expect(tech.getByText('Vì sao chọn')).toHaveCount(6);
    await expect(tech).toContainText('Giao dịch chốt sau khoảng 1-2 giây');
    await expect(tech.locator('img')).toHaveCount(0);
    // The factory link needs a deployment to take the address from; this build has none (sample data), so no link and no invented address.
    await expect(tech.getByRole('link', { name: /factory contract trên Snowtrace/ })).toHaveCount(0);
    await expect(tech).toContainText('Dự thi Avalanche Team1 Vietnam UniHack 2026, nhánh Social finance.');
    await expect(page.locator('#cong-nghe')).toHaveCount(1);
    // Order: Tình huống, then Công nghệ, then Sổ cái.
    const ids = await page.locator('main > section, main > header').evaluateAll((els) => els.map((e) => e.id));
    expect(ids.indexOf('tinh-huong')).toBeLessThan(ids.indexOf('cong-nghe'));
    expect(ids.indexOf('cong-nghe')).toBeLessThan(ids.indexOf('so-cai'));
  });

  test('B23 ledger: the new label and line', async ({ page }) => {
    await openStill(page);
    const ledger = page.locator('#so-cai');
    await expect(ledger).toContainText('Đã chạy thật, kiểm được');
    await expect(ledger).toContainText('Hai dây do nhóm chạy bằng ví demo, số tiền thu nhỏ 10 lần. Mỗi dòng mở ra giao dịch tương ứng trên Snowtrace.');
  });

  test('reduced motion: no intro, the ballot shows its final stamped state, nothing is moved', async ({ page }) => {
    await openStill(page);
    await expect(page.locator('[data-lp-intro]')).toBeHidden();
    await expect(page.locator('[data-lp-story]')).toHaveAttribute('data-state', '3');
    await expect(page.locator('[data-lp-line]').first()).toHaveCSS('transform', 'none');
  });
});

test.describe('S01 / landing motion', () => {
  test('intro covers the first paint and replays on every visit, can be skipped, ends by itself; ballot opens on scroll', async ({ page }) => {
    const errs = watchErrors(page);
    await page.goto('/');
    const intro = page.locator('[data-lp-intro]');
    const skip = intro.locator('button', { hasText: 'Bỏ qua' });
    await expect(skip).toBeVisible();
    await skip.click();
    await expect(intro).toBeHidden();
    await expect(page.locator('html')).toHaveClass(/lenis/);
    await expect(page.locator('[data-lp-line]').first()).toBeInViewport();

    await page.reload();
    await expect(intro).toBeVisible(); // every visit plays it
    await expect(intro).toBeHidden({ timeout: 6000 }); // and it ends on its own
    // After the curtain the hero has entered: the headline is in place, not stuck below its mask.
    await expect(page.locator('[data-lp-line]').first()).toHaveCSS('transform', /none|matrix\(1, 0, 0, 1, 0, 0\)/, { timeout: 4000 });

    const story = page.locator('[data-lp-story]');
    await page.locator('[data-step="3"]').scrollIntoViewIfNeeded();
    await expect(story).toHaveAttribute('data-state', '3', { timeout: 5000 });

    await page.getByRole('link', { name: 'Mở app' }).click();
    await expect(page).toHaveURL(/\/circles$/);
    await expect(page.locator('html')).not.toHaveClass(/lenis/);
    errs.expectClean();
  });
});
