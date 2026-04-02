const { pool } = require('../db/database');

const ACTION_LABELS = {
    CREATE: 'Tạo mới',
    UPDATE: 'Cập nhật',
    DELETE: 'Xóa',
};

const ENTITY_LABELS = {
    products: 'Sản phẩm',
    users: 'Người dùng',
    expenses: 'Khoản phát sinh',
    orders: 'Đơn hàng',
    stores: 'Cửa hàng',
    inventory: 'Nhập kho',
};

/**
 * Ghi log một hành động thay đổi dữ liệu.
 * Không throw — lỗi audit không ảnh hưởng tới operation chính.
 *
 * @param {{ action: 'CREATE'|'UPDATE'|'DELETE', entityType: string, entityId: number|null,
 *           entityName: string, changedFields?: string[]|null, userId: number, storeId?: number|null }} opts
 */
async function auditLog({ action, entityType, entityId, entityName, changedFields = null, userId, storeId = null }) {
    try {
        await pool.query(
            `INSERT INTO audit_logs (action, entity_type, entity_id, entity_name, changed_fields, user_id, store_id)
             VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [action, entityType, entityId || null, entityName || null,
             changedFields ? JSON.stringify(changedFields) : null, userId, storeId || null]
        );
    } catch (e) {
        console.warn('[audit] log error:', e.message);
    }
}

/**
 * So sánh hai object và trả về danh sách tên các field đã thay đổi.
 * Bỏ qua các field kỹ thuật và những giá trị thực ra giống nhau.
 */
function diffFields(oldObj, newObj, ignoreKeys = ['updated_at', 'created_at', 'id', 'image_url']) {
    if (!oldObj || !newObj) return null;
    const changed = [];
    for (const key of Object.keys(newObj)) {
        if (ignoreKeys.includes(key)) continue;
        const oldVal = oldObj[key] == null ? '' : String(oldObj[key]);
        const newVal = newObj[key] == null ? '' : String(newObj[key]);
        if (oldVal !== newVal) changed.push(key);
    }
    return changed.length ? changed : null;
}

module.exports = { auditLog, diffFields, ACTION_LABELS, ENTITY_LABELS };
