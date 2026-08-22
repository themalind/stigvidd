using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Infrastructure.Migrations
{
    /// <summary>
    /// Makes the server notice a client that has gone away. With the defaults it keeps a
    /// dead connection's transaction — and its locks — for over two hours, which is long
    /// enough to wedge a table after an interrupted write.
    /// </summary>
    public partial class TuneConnectionKeepalives : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // ALTER DATABASE needs a literal name, and the database is not called the same
            // thing everywhere, so the name comes from the connection. Lacking the privilege
            // warns instead of failing: migrations run at API startup and a tuning setting
            // must never be what stops it.
            migrationBuilder.Sql("""
                DO $$
                BEGIN
                    EXECUTE format('ALTER DATABASE %I SET tcp_keepalives_idle = 60', current_database());
                    EXECUTE format('ALTER DATABASE %I SET tcp_keepalives_interval = 10', current_database());
                    EXECUTE format('ALTER DATABASE %I SET tcp_keepalives_count = 9', current_database());
                    EXECUTE format('ALTER DATABASE %I SET client_connection_check_interval = ''10s''', current_database());
                EXCEPTION WHEN insufficient_privilege THEN
                    RAISE WARNING 'TuneConnectionKeepalives: not the owner of %, keepalive settings left alone.', current_database();
                END $$;
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                DO $$
                BEGIN
                    EXECUTE format('ALTER DATABASE %I RESET tcp_keepalives_idle', current_database());
                    EXECUTE format('ALTER DATABASE %I RESET tcp_keepalives_interval', current_database());
                    EXECUTE format('ALTER DATABASE %I RESET tcp_keepalives_count', current_database());
                    EXECUTE format('ALTER DATABASE %I RESET client_connection_check_interval', current_database());
                EXCEPTION WHEN insufficient_privilege THEN
                    RAISE WARNING 'TuneConnectionKeepalives: not the owner of %, keepalive settings left alone.', current_database();
                END $$;
                """);
        }
    }
}
