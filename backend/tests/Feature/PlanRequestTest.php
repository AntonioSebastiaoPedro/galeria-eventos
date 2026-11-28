<?php

namespace Tests\Feature;

use App\Models\Event;
use App\Models\PlanRequest;
use App\Models\User;
use App\Modules\Notificacoes\Notifications\PlanRequestReviewed;
use App\Modules\Notificacoes\Notifications\PlanRequestSubmitted;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class PlanRequestTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake('local');
        Notification::fake();
        config(['plans.payment.express_number' => '923000000', 'plans.payment.express_holder' => 'Galeria']);
    }

    private function submit(Event $event, string $plan = 'premium', ?UploadedFile $proof = null)
    {
        return $this->actingAs($event->user)->post("/api/events/{$event->id}/plan-request", [
            'plan' => $plan,
            'proof' => $proof ?? UploadedFile::fake()->image('comprovativo.jpg'),
        ], ['Accept' => 'application/json']);
    }

    public function test_organizer_sees_upgrades_with_the_difference_to_pay_and_the_express_number(): void
    {
        $event = Event::factory()->plan('basic')->create();

        $this->actingAs($event->user)->getJson("/api/events/{$event->id}/plan-request")->assertOk()
            ->assertJsonPath('current', null)
            ->assertJsonPath('upgrades.0.key', 'premium')->assertJsonPath('upgrades.0.amount_kz', 7000)
            ->assertJsonPath('upgrades.1.key', 'exclusive')->assertJsonPath('upgrades.1.amount_kz', 20000)
            ->assertJsonCount(2, 'upgrades')
            ->assertJsonPath('payment.number', '923000000');
    }

    public function test_organizer_requests_an_upgrade_paying_the_difference_and_admins_are_notified(): void
    {
        $admin = User::factory()->superadmin()->create();
        $event = Event::factory()->plan('basic')->create();

        $this->submit($event)->assertCreated()->assertJson(['status' => 'pending', 'from_plan' => 'basic', 'to_plan' => 'premium', 'amount_kz' => 7000]);

        $request = PlanRequest::sole();
        Storage::disk('local')->assertExists($request->proof_path);
        $this->assertSame('basic', $event->fresh()->plan); // só muda depois de confirmado
        Notification::assertSentTo($admin, PlanRequestSubmitted::class);
    }

    public function test_request_requires_an_image_or_pdf_proof(): void
    {
        $event = Event::factory()->plan('free')->create();

        $this->actingAs($event->user)->postJson("/api/events/{$event->id}/plan-request", ['plan' => 'basic'])
            ->assertUnprocessable()->assertJsonPath('errors.proof.0', 'Envie o comprovativo do pagamento (fotografia ou PDF).');
        $this->submit($event, 'basic', UploadedFile::fake()->create('comprovativo.txt', 1, 'text/plain'))
            ->assertUnprocessable()->assertJsonPath('errors.proof.0', 'O comprovativo tem de ser uma imagem (JPG, PNG, WebP) ou um PDF.');
        $this->submit($event, 'basic', UploadedFile::fake()->create('comprovativo.pdf', 20, 'application/pdf'))->assertCreated();
    }

    public function test_only_higher_plans_can_be_requested(): void
    {
        $event = Event::factory()->plan('premium')->create();

        $this->submit($event, 'basic')->assertUnprocessable()->assertJsonPath('errors.plan.0', 'Escolha um plano acima do actual.');
        $this->submit($event, 'premium')->assertUnprocessable();
        $this->assertSame(0, PlanRequest::count());
        $this->assertSame([], Storage::disk('local')->allFiles()); // o comprovativo de um pedido recusado não fica guardado
    }

    public function test_only_one_pending_request_per_event(): void
    {
        $event = Event::factory()->plan('basic')->create();
        $this->submit($event)->assertCreated();

        $this->submit($event, 'exclusive')->assertUnprocessable()->assertJsonPath('errors.plan.0', 'Já há um pedido à espera de confirmação para este evento.');
    }

    public function test_requests_are_refused_while_the_express_number_is_not_configured(): void
    {
        config(['plans.payment.express_number' => null]);
        $event = Event::factory()->plan('basic')->create();

        $this->submit($event)->assertUnprocessable()->assertJsonPath('errors.plan.0', 'Os pagamentos ainda não estão disponíveis. Fale com a equipa da Galeria.');
    }

    public function test_another_organizer_cannot_see_request_or_proof(): void
    {
        $planRequest = PlanRequest::factory()->create();
        $other = User::factory()->create();

        $this->actingAs($other)->getJson("/api/events/{$planRequest->event_id}/plan-request")->assertNotFound();
        $this->actingAs($other)->getJson("/api/plan-requests/{$planRequest->id}/proof")->assertNotFound();
        $this->actingAs($other)->deleteJson("/api/plan-requests/{$planRequest->id}")->assertNotFound();
    }

    public function test_proof_is_served_to_the_owner_and_the_admin_without_running_scripts(): void
    {
        $event = Event::factory()->plan('basic')->create();
        $this->submit($event, 'premium', UploadedFile::fake()->create('comprovativo.pdf', 20, 'application/pdf'))->assertCreated();
        $id = PlanRequest::sole()->id;

        $this->actingAs($event->user)->get("/api/plan-requests/{$id}/proof")->assertOk()->assertHeader('Content-Security-Policy', 'sandbox');
        $this->actingAs(User::factory()->superadmin()->create())->get("/api/plan-requests/{$id}/proof")->assertOk();
    }

    public function test_organizer_cancels_a_pending_request_and_the_proof_is_deleted(): void
    {
        $event = Event::factory()->plan('basic')->create();
        $this->submit($event)->assertCreated();
        $request = PlanRequest::sole();

        $this->actingAs($event->user)->deleteJson("/api/plan-requests/{$request->id}")->assertOk();

        $this->assertSame('cancelled', $request->fresh()->status);
        Storage::disk('local')->assertMissing($request->proof_path);
    }

    public function test_admin_approves_and_the_event_changes_plan(): void
    {
        $admin = User::factory()->superadmin()->create();
        $planRequest = PlanRequest::factory()->create();

        $this->actingAs($admin)->postJson("/api/admin/plan-requests/{$planRequest->id}/approve")->assertOk()->assertJson(['status' => 'approved']);

        $this->assertSame('premium', $planRequest->event->fresh()->plan);
        Notification::assertSentTo($planRequest->event->user, PlanRequestReviewed::class);
        $this->actingAs($admin)->postJson("/api/admin/plan-requests/{$planRequest->id}/approve")
            ->assertUnprocessable()->assertJsonPath('errors.status.0', 'Este pedido já foi tratado.');
    }

    public function test_approval_never_lowers_a_plan_raised_in_the_meantime(): void
    {
        $planRequest = PlanRequest::factory()->create();
        $planRequest->event->update(['plan' => 'exclusive']);

        $this->actingAs(User::factory()->superadmin()->create())->postJson("/api/admin/plan-requests/{$planRequest->id}/approve")->assertOk();

        $this->assertSame('exclusive', $planRequest->event->fresh()->plan);
    }

    public function test_admin_rejects_with_a_reason_and_the_plan_stays(): void
    {
        $admin = User::factory()->superadmin()->create();
        $planRequest = PlanRequest::factory()->create();

        $this->actingAs($admin)->postJson("/api/admin/plan-requests/{$planRequest->id}/reject")
            ->assertUnprocessable()->assertJsonPath('errors.reason.0', 'Escreva o motivo: o organizador vai vê-lo.');
        $this->actingAs($admin)->postJson("/api/admin/plan-requests/{$planRequest->id}/reject", ['reason' => 'O valor recebido foi 5 000 Kz.'])
            ->assertOk()->assertJson(['status' => 'rejected', 'admin_note' => 'O valor recebido foi 5 000 Kz.']);

        $this->assertSame('basic', $planRequest->event->fresh()->plan);
        $this->actingAs($planRequest->event->user)->getJson("/api/events/{$planRequest->event_id}/plan-request")
            ->assertJsonPath('current.status', 'rejected')->assertJsonPath('current.admin_note', 'O valor recebido foi 5 000 Kz.');
    }

    public function test_owner_without_email_is_not_emailed(): void
    {
        $owner = User::factory()->create(['email' => null, 'phone' => '+244923456789']);
        $planRequest = PlanRequest::factory()->for(Event::factory()->for($owner)->plan('basic'))->create();

        $this->actingAs(User::factory()->superadmin()->create())->postJson("/api/admin/plan-requests/{$planRequest->id}/approve")->assertOk();

        Notification::assertNotSentTo($owner, PlanRequestReviewed::class);
    }

    public function test_organizers_cannot_use_the_admin_endpoints(): void
    {
        $planRequest = PlanRequest::factory()->create();

        $this->actingAs($planRequest->event->user)->postJson("/api/admin/plan-requests/{$planRequest->id}/approve")->assertForbidden();
        $this->assertSame('basic', $planRequest->event->fresh()->plan);
    }

    public function test_admin_lists_pending_requests_with_organizer_contact(): void
    {
        $owner = User::factory()->create(['email' => null, 'phone' => '+244923456789']);
        PlanRequest::factory()->for(Event::factory()->for($owner)->plan('basic'))->create();
        PlanRequest::factory()->create(['status' => 'rejected']);

        $this->actingAs(User::factory()->superadmin()->create())->getJson('/api/admin/plan-requests')->assertOk()
            ->assertJsonCount(1, 'data')->assertJsonPath('data.0.user.phone', '+244923456789');
    }
}
