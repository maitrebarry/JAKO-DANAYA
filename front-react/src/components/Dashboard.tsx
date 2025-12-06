const Dashboard = () => {
  return (
    <div className="row">
      <div className="col-xl-3 col-lg-6">
        <div className="card">
          <div className="card-body">
            <div className="d-flex align-items-center">
              <div className="flex-grow-1">
                <h4 className="mt-0 mb-1">Ventes</h4>
                <p className="text-muted mb-0">Total des ventes</p>
              </div>
              <div className="avatar-sm">
                <span className="avatar-title bg-primary rounded-circle">
                  <i className="ti ti-cash font-24"></i>
                </span>
              </div>
            </div>
            <h3 className="mt-3 mb-0">0</h3>
          </div>
        </div>
      </div>
      <div className="col-xl-3 col-lg-6">
        <div className="card">
          <div className="card-body">
            <div className="d-flex align-items-center">
              <div className="flex-grow-1">
                <h4 className="mt-0 mb-1">Produits</h4>
                <p className="text-muted mb-0">Nombre de produits</p>
              </div>
              <div className="avatar-sm">
                <span className="avatar-title bg-success rounded-circle">
                  <i className="ti ti-package font-24"></i>
                </span>
              </div>
            </div>
            <h3 className="mt-3 mb-0">0</h3>
          </div>
        </div>
      </div>
      <div className="col-xl-3 col-lg-6">
        <div className="card">
          <div className="card-body">
            <div className="d-flex align-items-center">
              <div className="flex-grow-1">
                <h4 className="mt-0 mb-1">Clients</h4>
                <p className="text-muted mb-0">Nombre de clients</p>
              </div>
              <div className="avatar-sm">
                <span className="avatar-title bg-info rounded-circle">
                  <i className="ti ti-users font-24"></i>
                </span>
              </div>
            </div>
            <h3 className="mt-3 mb-0">0</h3>
          </div>
        </div>
      </div>
      <div className="col-xl-3 col-lg-6">
        <div className="card">
          <div className="card-body">
            <div className="d-flex align-items-center">
              <div className="flex-grow-1">
                <h4 className="mt-0 mb-1">Fournisseurs</h4>
                <p className="text-muted mb-0">Nombre de fournisseurs</p>
              </div>
              <div className="avatar-sm">
                <span className="avatar-title bg-warning rounded-circle">
                  <i className="ti ti-truck font-24"></i>
                </span>
              </div>
            </div>
            <h3 className="mt-3 mb-0">0</h3>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;