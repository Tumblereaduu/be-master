// ============================================================================
// RBAC MIDDLEWARE TEST SUITE
// ============================================================================
// Tests for role-based access control middleware functions
// Specifically tests the allowRoles() function with multiple roles

const {
  allowMaster,
  allowAdmin,
  allowUser,
  allowRoles,
  tenantMiddleware
} = require('./rbacMiddleware');

// ============================================================================
// HELPER FUNCTION: Create Mock Request/Response
// ============================================================================
function createMockReqRes(userRole = null) {
  const req = {
    user: userRole ? { role: userRole } : null
  };

  const res = {
    status: jest.fn(function(code) {
      this.statusCode = code;
      return this;
    }),
    json: jest.fn(function(data) {
      this.jsonData = data;
      return this;
    })
  };

  const next = jest.fn();

  return { req, res, next };
}

// ============================================================================
// ALLOWROLES TESTS - Focus on multiple role support
// ============================================================================
describe('allowRoles() - Multiple Role Support', () => {
  
  describe('allowRoles("master", "admin") - Two Roles', () => {
    let middleware;

    beforeEach(() => {
      middleware = allowRoles("master", "admin");
    });

    it('should allow master role to pass', () => {
      const { req, res, next } = createMockReqRes("master");
      
      middleware(req, res, next);
      
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should allow admin role to pass', () => {
      const { req, res, next } = createMockReqRes("admin");
      
      middleware(req, res, next);
      
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should reject user role with 403 Forbidden', () => {
      const { req, res, next } = createMockReqRes("user");
      
      middleware(req, res, next);
      
      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          status: "error",
          message: expect.stringContaining("master, admin")
        })
      );
    });

    it('should return 403 with proper error message', () => {
      const { req, res, next } = createMockReqRes("user");
      
      middleware(req, res, next);
      
      expect(res.json).toHaveBeenCalledWith({
        status: "error",
        message: "Access denied. Requires one of: master, admin."
      });
    });

    it('should reject invalid role with 403 Forbidden', () => {
      const { req, res, next } = createMockReqRes("superuser");
      
      middleware(req, res, next);
      
      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(403);
    });

    it('should return 401 when user is not attached to request', () => {
      const { req, res, next } = createMockReqRes(null);
      
      middleware(req, res, next);
      
      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        status: "error",
        message: "Unauthorized. No user in request."
      });
    });
  });

  describe('allowRoles("admin") - Single Role', () => {
    let middleware;

    beforeEach(() => {
      middleware = allowRoles("admin");
    });

    it('should allow admin role to pass', () => {
      const { req, res, next } = createMockReqRes("admin");
      
      middleware(req, res, next);
      
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should reject master role with 403', () => {
      const { req, res, next } = createMockReqRes("master");
      
      middleware(req, res, next);
      
      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(403);
    });

    it('should reject user role with 403', () => {
      const { req, res, next } = createMockReqRes("user");
      
      middleware(req, res, next);
      
      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(403);
    });
  });

  describe('allowRoles("master", "admin", "user") - Three Roles', () => {
    let middleware;

    beforeEach(() => {
      middleware = allowRoles("master", "admin", "user");
    });

    it('should allow master role to pass', () => {
      const { req, res, next } = createMockReqRes("master");
      
      middleware(req, res, next);
      
      expect(next).toHaveBeenCalled();
    });

    it('should allow admin role to pass', () => {
      const { req, res, next } = createMockReqRes("admin");
      
      middleware(req, res, next);
      
      expect(next).toHaveBeenCalled();
    });

    it('should allow user role to pass', () => {
      const { req, res, next } = createMockReqRes("user");
      
      middleware(req, res, next);
      
      expect(next).toHaveBeenCalled();
    });

    it('should reject unknown role with 403', () => {
      const { req, res, next } = createMockReqRes("superuser");
      
      middleware(req, res, next);
      
      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(403);
    });
  });

  describe('allowRoles() - Edge Cases', () => {
    it('should handle empty roles array gracefully', () => {
      const middleware = allowRoles();
      const { req, res, next } = createMockReqRes("user");
      
      middleware(req, res, next);
      
      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(403);
    });

    it('should handle case-sensitive role matching', () => {
      const middleware = allowRoles("master", "admin");
      const { req, res, next } = createMockReqRes("Master");
      
      middleware(req, res, next);
      
      // Should reject because role is "Master" not "master"
      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(403);
    });

    it('should include all roles in error message', () => {
      const middleware = allowRoles("master", "admin", "user");
      const { req, res, next } = createMockReqRes("guest");
      
      middleware(req, res, next);
      
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: "Access denied. Requires one of: master, admin, user."
        })
      );
    });

    it('should handle middleware error gracefully', () => {
      const middleware = allowRoles("master", "admin");
      const { req, res, next } = createMockReqRes("master");
      
      // Simulate an error in the middleware
      jest.spyOn(console, 'error').mockImplementation(() => {});
      
      // This should not throw
      expect(() => {
        middleware(req, res, next);
      }).not.toThrow();
      
      console.error.mockRestore();
    });
  });

  describe('allowRoles("master", "admin") - Real-world Scenarios', () => {
    let middleware;

    beforeEach(() => {
      middleware = allowRoles("master", "admin");
    });

    it('should work with user object containing additional properties', () => {
      const { req, res, next } = createMockReqRes("master");
      req.user = {
        role: "master",
        user_id: 1,
        master_id: 1,
        admin_id: null,
        email: "master@example.com"
      };
      
      middleware(req, res, next);
      
      expect(next).toHaveBeenCalled();
    });

    it('should work in a request/response cycle', () => {
      const middleware = allowRoles("master", "admin");
      const { req, res, next } = createMockReqRes("admin");
      
      // Simulate multiple calls (middleware reusability)
      middleware(req, res, next);
      expect(next).toHaveBeenCalledTimes(1);
      
      // Reset and test with different role
      jest.clearAllMocks();
      const { req: req2, res: res2, next: next2 } = createMockReqRes("user");
      middleware(req2, res2, next2);
      expect(next2).not.toHaveBeenCalled();
    });

    it('should prevent access to unauthorized roles in sequence', () => {
      const middleware = allowRoles("master", "admin");
      
      // Test sequence: unauthorized -> authorized
      const { req: req1, res: res1, next: next1 } = createMockReqRes("user");
      middleware(req1, res1, next1);
      expect(next1).not.toHaveBeenCalled();
      
      // Reset
      jest.clearAllMocks();
      
      // Now test authorized
      const { req: req2, res: res2, next: next2 } = createMockReqRes("admin");
      middleware(req2, res2, next2);
      expect(next2).toHaveBeenCalled();
    });
  });
});

// ============================================================================
// OTHER MIDDLEWARE TESTS (for completeness)
// ============================================================================
describe('allowMaster() - Single Role', () => {
  it('should allow only master role', () => {
    const { req, res, next } = createMockReqRes("master");
    
    allowMaster(req, res, next);
    
    expect(next).toHaveBeenCalled();
  });

  it('should reject admin role with 403', () => {
    const { req, res, next } = createMockReqRes("admin");
    
    allowMaster(req, res, next);
    
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('should reject user role with 403', () => {
    const { req, res, next } = createMockReqRes("user");
    
    allowMaster(req, res, next);
    
    expect(res.status).toHaveBeenCalledWith(403);
  });
});

describe('allowAdmin() - Master and Admin', () => {
  it('should allow master role', () => {
    const { req, res, next } = createMockReqRes("master");
    
    allowAdmin(req, res, next);
    
    expect(next).toHaveBeenCalled();
  });

  it('should allow admin role', () => {
    const { req, res, next } = createMockReqRes("admin");
    
    allowAdmin(req, res, next);
    
    expect(next).toHaveBeenCalled();
  });

  it('should reject user role with 403', () => {
    const { req, res, next } = createMockReqRes("user");
    
    allowAdmin(req, res, next);
    
    expect(res.status).toHaveBeenCalledWith(403);
  });
});

describe('allowUser() - All Roles', () => {
  it('should allow master role', () => {
    const { req, res, next } = createMockReqRes("master");
    
    allowUser(req, res, next);
    
    expect(next).toHaveBeenCalled();
  });

  it('should allow admin role', () => {
    const { req, res, next } = createMockReqRes("admin");
    
    allowUser(req, res, next);
    
    expect(next).toHaveBeenCalled();
  });

  it('should allow user role', () => {
    const { req, res, next } = createMockReqRes("user");
    
    allowUser(req, res, next);
    
    expect(next).toHaveBeenCalled();
  });

  it('should reject invalid role with 403', () => {
    const { req, res, next } = createMockReqRes("guest");
    
    allowUser(req, res, next);
    
    expect(res.status).toHaveBeenCalledWith(403);
  });
});

describe('tenantMiddleware()', () => {
  it('should attach tenant context to request for master', () => {
    const { req, res, next } = createMockReqRes("master");
    req.user.master_id = 1;
    req.user.admin_id = null;
    req.user.user_id = null;
    
    tenantMiddleware(req, res, next);
    
    expect(req.tenant).toBeDefined();
    expect(req.tenant.role).toBe("master");
    expect(req.tenant.master_id).toBe(1);
    expect(next).toHaveBeenCalled();
  });

  it('should attach tenant context to request for admin', () => {
    const { req, res, next } = createMockReqRes("admin");
    req.user.master_id = 1;
    req.user.admin_id = 2;
    req.user.user_id = null;
    
    tenantMiddleware(req, res, next);
    
    expect(req.tenant).toBeDefined();
    expect(req.tenant.role).toBe("admin");
    expect(req.tenant.admin_id).toBe(2);
    expect(next).toHaveBeenCalled();
  });

  it('should return 401 when user is not present', () => {
    const { req, res, next } = createMockReqRes(null);
    
    tenantMiddleware(req, res, next);
    
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });
});
