using Microsoft.AspNetCore.Mvc;
using Core.Interfaces;

namespace StigviddAPI.Controllers;

    [ApiController]
    [Route("api/[controller]")]
    public class TrailController(ITrailService service) : Controller
    {
        private readonly ITrailService _service;
        public IActionResult Index()
        { 
            return View();
        }
    }

