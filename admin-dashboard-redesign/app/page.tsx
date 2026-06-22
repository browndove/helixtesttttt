'use client';

import { useState } from 'react';
import { Search, Plus, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Facility {
  name: string;
  code: string;
}

export default function AdminDashboard() {
  const [searchQuery, setSearchQuery] = useState('');

  const facilities: Facility[] = [
    { name: 'Accra Medical Center', code: 'AMC' },
    { name: 'Alpha Clinic', code: 'AC' },
    { name: 'Black River Hospital', code: 'BRH' },
    { name: 'Campeh Clinic', code: 'CC' },
    { name: 'Cape Coast Teaching Hospital', code: 'CCTH' },
    { name: 'chris', code: 'CHRIS2' },
    { name: 'chris', code: 'CHRIS' },
    { name: 'dennis', code: 'DENII' },
    { name: 'First Love Hospital', code: 'FLH' },
    { name: 'Helix Health', code: 'HH' },
    { name: 'Holy Ghost hospital', code: 'HGH' },
    { name: 'Ridge Hospital', code: 'RH' },
    { name: 'Riverside General Hospital', code: 'RGH' },
  ];

  const filteredFacilities = facilities.filter(
    (facility) =>
      facility.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      facility.code.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const adminLinks = [
    { label: 'Test Admin', href: '#' },
    { label: 'Production Admin', href: '#' },
    { label: 'Test Analytics', href: '#' },
    { label: 'Production Analytics', href: '#' },
    { label: 'Onboarding Admin', href: '#' },
    { label: 'Global Download', href: '#' },
  ];

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      {/* Main Content */}
      <main className="flex-1">
        {/* Header */}
        <div className="border-b border-border bg-card/50 backdrop-blur-sm">
          <div className="mx-auto max-w-7xl px-6 py-8">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold tracking-tight">Internal Admin Dashboard</h1>
                <p className="mt-2 text-sm text-muted-foreground">
                  Select a facility to enter support mode and view the tenant app context.
                </p>
              </div>
              <div className="flex gap-3">
                <Button variant="outline" size="sm">
                  Exit internal session
                </Button>
                <Button size="sm" className="gap-2">
                  <Plus className="h-4 w-4" />
                  Add Facility
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="border-b border-border bg-card/30">
          <div className="mx-auto max-w-7xl px-6 py-6">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
              <div className="relative md:col-span-2">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search facility by name or code..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full rounded-lg border border-border bg-input px-4 py-2.5 pl-10 text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <input
                type="text"
                placeholder="Ticket ID (optional)"
                className="rounded-lg border border-border bg-input px-4 py-2.5 text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <input
                type="text"
                placeholder="Reason (optional)"
                className="rounded-lg border border-border bg-input px-4 py-2.5 text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="mx-auto max-w-7xl px-6 py-8">
          <div className="overflow-hidden rounded-lg border border-border">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-card/80">
                  <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Facility
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Code
                  </th>
                  <th className="px-6 py-4 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredFacilities.map((facility, index) => (
                  <tr
                    key={index}
                    className="border-b border-border/50 transition-colors hover:bg-card/50"
                  >
                    <td className="px-6 py-4 text-sm font-medium">{facility.name}</td>
                    <td className="px-6 py-4">
                      <span className="inline-block rounded bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
                        {facility.code}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90">
                        Access facility
                        <ArrowRight className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {filteredFacilities.length === 0 && (
            <div className="mt-8 flex flex-col items-center justify-center rounded-lg border border-border/50 bg-card/20 py-12">
              <p className="text-muted-foreground">No facilities found matching your search.</p>
            </div>
          )}
        </div>
      </main>

      {/* Footer with Admin Links */}
      <footer className="border-t border-border bg-card/30 backdrop-blur-sm">
        <div className="mx-auto max-w-7xl px-6 py-8">
          <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
            {adminLinks.map((link, index) => (
              <a
                key={index}
                href={link.href}
                className="group flex flex-col items-start gap-2 rounded-lg p-3 transition-all hover:bg-card/50"
              >
                <span className="text-sm font-medium text-foreground group-hover:text-accent">
                  {link.label}
                </span>
                <span className="text-xs text-muted-foreground group-hover:text-muted-foreground/80">
                  View details
                </span>
              </a>
            ))}
          </div>
          <div className="mt-8 border-t border-border/50 pt-6">
            <p className="text-center text-xs text-muted-foreground">
              Internal Admin Dashboard • All access is logged and monitored
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
