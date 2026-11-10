import { expect, test } from '@playwright/test';
import { noHorizontalOverflow, watchErrors } from './helpers';

test('S05 with phi > 0 shows the per-round commission table before the person joins (B19)', async ({ page }) => {
  const errs = watchErrors(page);
  await page.goto('/moi/dang-gom'); // sample circle with phi = 50%, fee ceiling 3%, N = 5, C = 10 USDC
  const section = page.getByRole('region', { name: 'Hoa hồng của chủ hụi theo từng kỳ' });
  await expect(section.getByRole('heading', { name: 'Trần thăm và hoa hồng từng kỳ' })).toBeVisible();
  await expect(section).toContainText('Chủ hụi lấy 50%');
  const table = section.getByRole('region', { name: /Bảng trần thăm và hoa hồng từng kỳ/ });
  await expect(table.getByRole('row')).toHaveCount(6); // header + 5 rounds
  await expect(table).toContainText('0,657534'); // statutory cap of round 1, docs/03 section 8 divided by 10
  await expect(table).toContainText('0,328767'); // enforced cap = half of it (docs/03 section 8.1 divided by 10)
  await expect(section).toContainText('Kỳ chủ hụi tự hốt không thu hoa hồng');
  await noHorizontalOverflow(page);
  errs.expectClean();
});
