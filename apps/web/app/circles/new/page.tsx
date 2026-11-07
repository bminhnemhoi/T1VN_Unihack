import { CreateWizard } from '@/components/wizard/CreateWizard';

/** S03: create a circle in three steps. Coverage numbers update as you type. */
export default function NewCircle() {
  return (
    <main id="noi-dung" className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="font-display text-4xl font-bold md:text-5xl">Tạo dây</h1>
      <p className="mt-2 mb-8 max-w-prose text-xl text-muted-foreground">Ba bước. Chỉ số bảo chứng và trần thăm tự cập nhật khi bạn gõ.</p>
      <CreateWizard />
    </main>
  );
}
