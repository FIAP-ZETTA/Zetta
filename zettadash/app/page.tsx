import { MetricCards } from "@/components/dash/metric-cards"
import { EventsTimeline } from "@/components/dash/events-timeline"
import { RecentActivity } from "@/components/dash/recent-activity"

export default function ZettaDashPage() {
  return (
    <div className="space-y-6">
      <MetricCards />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <EventsTimeline />
        </div>
        <RecentActivity />
      </div>
    </div>
  )
}
