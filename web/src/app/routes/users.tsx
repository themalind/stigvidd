// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { Page, PageHeader } from "@/components/page";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AuthorsTable } from "@/features/users/components/authors-table";
import { ReportersTable } from "@/features/users/components/reporters-table";
import { PagedTab } from "@/features/users/components/statistics-tab";

export default function UsersPage() {
  return (
    <Page width="wide">
      <PageHeader title="Users" description="Who reports, and whose content gets removed." />

      <Tabs defaultValue="reporters">
        <TabsList>
          <TabsTrigger value="reporters">Reporters</TabsTrigger>
          <TabsTrigger value="authors">Authors</TabsTrigger>
        </TabsList>

        <TabsContent value="reporters">
          <PagedTab>{(props) => <ReportersTable {...props} />}</PagedTab>
        </TabsContent>
        <TabsContent value="authors">
          <PagedTab>{(props) => <AuthorsTable {...props} />}</PagedTab>
        </TabsContent>
      </Tabs>
    </Page>
  );
}
