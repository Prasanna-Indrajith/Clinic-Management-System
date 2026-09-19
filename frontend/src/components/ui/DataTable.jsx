/**
 * DataTable — reusable table with pagination, sorting, and empty state.
 *
 * @param {Array} columns  — [{ key, label, sortable, render }]
 * @param {Array} data     — array of row objects
 * @param {object} pagination — { page, limit, total, totalPages }
 * @param {function} onPageChange — (newPage) => void
 * @param {function} onSort — (key, direction) => void
 * @param {string} sortKey  — currently sorted column key
 * @param {string} sortDir  — 'asc' | 'desc'
 */
export default function DataTable({
    columns,
    data,
    pagination,
    onPageChange,
    onSort,
    sortKey,
    sortDir,
}) {
    const { page = 1, totalPages = 1 } = pagination || {};

    const handleSort = (key) => {
        if (!onSort) return;
        if (sortKey === key) {
            onSort(key, sortDir === 'asc' ? 'desc' : 'asc');
        } else {
            onSort(key, 'asc');
        }
    };

    const getSortIndicator = (key) => {
        if (sortKey !== key) return ' ⇅';
        return sortDir === 'asc' ? ' ↑' : ' ↓';
    };

    return (
        <div className="data-table">
            <div className="table-wrapper">
                <table className="table">
                    <thead>
                        <tr>
                            {columns.map((col) => (
                                <th
                                    key={col.key}
                                    onClick={() => (col.sortable ? handleSort(col.key) : null)}
                                    style={{ cursor: col.sortable ? 'pointer' : 'default' }}
                                    className={col.sortable ? 'sortable' : ''}
                                >
                                    {col.label}
                                    {col.sortable ? getSortIndicator(col.key) : null}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {data.length === 0 ? (
                            <tr>
                                <td colSpan={columns.length} className="table-empty">
                                    No records found.
                                </td>
                            </tr>
                        ) : (
                            data.map((row, i) => (
                                <tr key={row.id || row.patient_id || row.doctor_id || row.appointment_id || i}>
                                    {columns.map((col) => (
                                        <td key={col.key}>
                                            {col.render ? col.render(row[col.key], row) : row[col.key]}
                                        </td>
                                    ))}
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {pagination && totalPages > 1 && (
                <div className="table-pagination">
                    <button
                        className="btn btn-ghost btn-sm"
                        onClick={() => onPageChange(page - 1)}
                        disabled={page <= 1}
                    >
                        Previous
                    </button>
                    <span className="pagination-info">
                        Page {page} of {totalPages}
                    </span>
                    <button
                        className="btn btn-ghost btn-sm"
                        onClick={() => onPageChange(page + 1)}
                        disabled={page >= totalPages}
                    >
                        Next
                    </button>
                </div>
            )}
        </div>
    );
}
