'use client';

import FacilityGeofence from '@/components/geofence/FacilityGeofence';
import '@/components/glass/glass-page.css';
import './scheduling.css';

/** Scheduling on this deployment is the Geofencing tab only (rosters, attendance and setup are not shipped yet). */
export default function SchedulingWorkspace() {
    return (
        <div className="app-main gx-page sc-page">
            {/* Own header (not TopBar) so the tabs can sit inside the card and wrap on smaller screens. */}
            <header className="glass sc-header">
                <div className="sc-header__inner">
                    <div className="sc-header__id">
                        <h1 className="sc-header__title">Scheduling</h1>
                        <span className="sc-header__dot" aria-hidden>·</span>
                        <span className="sc-header__sub" title="Facility boundary for clock-in">Facility boundary for clock-in</span>
                    </div>
                    <div className="sx-tabs sc-header__tabs" role="tablist" aria-label="Scheduling sections">
                        <button type="button" role="tab" aria-selected className="sx-tab is-active">
                            <span className="sx-tab__icon"><span className="material-icons-round">travel_explore</span></span>
                            Geofencing
                        </button>
                    </div>
                </div>
            </header>

            <main className="sc-main sc-main--fill">
                <FacilityGeofence embedded />
            </main>
        </div>
    );
}
