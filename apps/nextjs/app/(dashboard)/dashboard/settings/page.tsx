import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { customerPortalAction } from "@/lib/payments/actions";

function SubscriptionContent() {
  return (
    <div className="space-y-4">
      <div className="flex">
        <form action={customerPortalAction}>
          <Button
            type="submit"
            className="bg-orange-500 hover:bg-orange-600 text-white border border-orange-600 rounded-full text-lg px-8 py-4 inline-flex items-center justify-center"
          >
            Manage Subscription
          </Button>
        </form>
      </div>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-2xl font-bold">Subscription</CardTitle>
      </CardHeader>
      <CardContent>
        <SubscriptionContent />
      </CardContent>
    </Card>
  );
}
